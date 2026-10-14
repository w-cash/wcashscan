'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');

/**
 * Shared W.cash Wolf JSON-RPC client.
 *
 * The browser must never call Wolf directly. API routes and the indexer use
 * this small client so RPC URL selection, cookie rotation, response limits,
 * and error handling are consistent in local, regtest, and container runs.
 */

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 4,
  maxFreeSockets: 2,
  timeout: 10000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 4,
  maxFreeSockets: 2,
  timeout: 10000,
});

// A verbose block can be large, but an unbounded response is unsafe for a
// public API process. This is a transport cap, not a product-level block cap.
const MAX_RPC_RESPONSE_BYTES = 50 * 1024 * 1024;

function getRpcUrl() {
  const configured = process.env.WCASH_RPC_URL;
  if (configured) return configured;

  const chain = process.env.WCASH_CHAIN || 'wcash-testnet-v5';
  const port = chain === 'wcash-regtest' || chain === 'regtest' ? 48232 : 38232;
  return `http://127.0.0.1:${port}`;
}

function getCookieFile() {
  return process.env.WCASH_RPC_COOKIE_FILE || '';
}

function getAuthHeader() {
  const cookieFile = getCookieFile();
  if (cookieFile) {
    try {
      // Wolf can rotate its cookie. Read it per request instead of caching a
      // credential that becomes stale after a node restart.
      const cookie = fs.readFileSync(cookieFile, 'utf8').trim();
      if (cookie) return `Basic ${Buffer.from(cookie).toString('base64')}`;
    } catch {
      // Fall through to explicit user/password auth, or no Authorization
      // header for a deliberately unauthenticated local test node.
    }
  }

  const user = process.env.WCASH_RPC_USER;
  const password = process.env.WCASH_RPC_PASSWORD;
  if (user || password) {
    return `Basic ${Buffer.from(`${user || ''}:${password || ''}`).toString('base64')}`;
  }

  return null;
}

function rpcErrorMessage(response, body) {
  if (response?.error?.message) return response.error.message;
  if (response?.error) return JSON.stringify(response.error);
  return body ? body.slice(0, 160) : 'Unknown RPC error';
}

async function callZebraRPC(method, params = [], { timeout = 8000 } = {}) {
  const rpcUrl = getRpcUrl();
  let url;
  try {
    url = new URL(rpcUrl);
  } catch {
    throw new Error(`Invalid Wcash RPC URL: ${rpcUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported Wcash RPC protocol: ${url.protocol}`);
  }

  const requestBody = JSON.stringify({
    jsonrpc: '1.0',
    id: 'wcashscan-api',
    method,
    params,
  });
  const auth = getAuthHeader();
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const succeed = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
    };
    if (auth) headers.Authorization = auth;

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname || '/'}${url.search || ''}`,
        method: 'POST',
        agent: url.protocol === 'https:' ? httpsAgent : httpAgent,
        timeout,
        headers,
      },
      (res) => {
        const chunks = [];
        let bytes = 0;

        res.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_RPC_RESPONSE_BYTES) {
            req.destroy();
            fail(new Error(`Wcash RPC response exceeded ${MAX_RPC_RESPONSE_BYTES} bytes`));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) {
            fail(new Error(`Wcash RPC HTTP ${res.statusCode}: ${body.slice(0, 160)}`));
            return;
          }

          let response;
          try {
            response = JSON.parse(body);
          } catch {
            fail(new Error(`Failed to parse Wcash RPC response: ${body.slice(0, 160)}`));
            return;
          }

          if (response.error) {
            fail(new Error(`Wcash RPC ${method} failed: ${rpcErrorMessage(response, body)}`));
            return;
          }
          succeed(response.result);
        });

        res.on('error', fail);
      }
    );

    req.setTimeout(timeout, () => {
      req.destroy();
      fail(new Error(`Wcash RPC ${method} timed out after ${timeout}ms`));
    });
    req.on('error', (error) => fail(new Error(`Wcash RPC request failed: ${error.message}`)));
    req.end(requestBody);
  });
}

// Keep the existing internal symbol for compatibility with imported route
// modules, while making the W.cash name explicit at new call sites.
const callWcashRPC = callZebraRPC;

module.exports = {
  callZebraRPC,
  callWcashRPC,
  getRpcUrl,
  getCookieFile,
  getAuthHeader,
  MAX_RPC_RESPONSE_BYTES,
};
