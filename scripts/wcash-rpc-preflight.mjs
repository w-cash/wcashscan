#!/usr/bin/env node

/**
 * Bounded, read-only W.cash RPC preflight.
 *
 * The explorer must fail closed on an unexpected chain. This command is also
 * used inside the API/indexer container, so it deliberately emits only
 * sanitized public chain facts and never logs authentication material.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilesDocument = JSON.parse(await readFile(path.join(root, 'config/wcash-networks.json'), 'utf8'));

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const profileId = argValue('--profile') || process.env.WCASH_CHAIN || 'wcash-testnet-v5';
const profile = profilesDocument.profiles[profileId];
if (!profile) throw new Error(`Unknown Wcash profile: ${profileId}`);

const rpcUrl = (
  argValue('--rpc-url')
  || process.env.WCASH_RPC_URL
  || (profileId === 'wcash-regtest' ? 'http://127.0.0.1:48232' : 'http://127.0.0.1:38232')
).replace(/\/+$/, '');
const cookieFile = argValue('--cookie-file') || process.env.WCASH_RPC_COOKIE_FILE;
const timeoutMs = Number(process.env.WCASH_RPC_TIMEOUT_MS || 15_000);

function normalizeHash(value) {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function branchIdFrom(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.replace(/^0x/i, '').toLowerCase();
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value.toString(16).padStart(8, '0');
  if (typeof value === 'object') {
    return branchIdFrom(value.branchId ?? value.branch_id ?? value.id ?? value.nextblock ?? value.nextBlock);
  }
  return null;
}

async function rpc(method, params = []) {
  const headers = { 'content-type': 'application/json' };
  let credentials = null;
  if (cookieFile) {
    const cookie = (await readFile(cookieFile, 'utf8')).trim();
    if (cookie) credentials = cookie;
  }
  if (!credentials && process.env.WCASH_RPC_USER && process.env.WCASH_RPC_PASSWORD) {
    credentials = `${process.env.WCASH_RPC_USER}:${process.env.WCASH_RPC_PASSWORD}`;
  }
  if (credentials) {
    headers.authorization = `Basic ${Buffer.from(credentials).toString('base64')}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: `wcashscan-${method}`, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(`${method} returned an RPC error`);
    return payload.result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`${method} timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const evidence = {
  profile: profile.id,
  chain: profile.chain,
  expectedGenesis: profile.genesisHash,
  rpcUrl: new URL(rpcUrl).origin,
  probedAt: new Date().toISOString(),
};

const [genesisHash, blockCount, blockchainInfo, networkInfo] = await Promise.all([
  rpc('getblockhash', [0]),
  rpc('getblockcount'),
  rpc('getblockchaininfo'),
  rpc('getnetworkinfo'),
]);

if (normalizeHash(genesisHash) !== normalizeHash(profile.genesisHash)) {
  throw new Error(`Wcash genesis mismatch: expected ${profile.genesisHash}, got ${genesisHash}`);
}

const reportedChain = blockchainInfo?.chain;
if (reportedChain && reportedChain !== profile.rpcChain && !(profile.rpcChain === 'test' && reportedChain === 'regtest')) {
  throw new Error(`RPC chain mismatch: expected ${profile.rpcChain}, got ${reportedChain}`);
}

const subversion = String(networkInfo?.subversion || networkInfo?.version || '');
if (subversion && !/(?:wcash|wolf)/i.test(subversion)) {
  throw new Error('RPC does not identify itself as a Wcash/Wolf node');
}

const tip = Number(blockCount);
if (!Number.isSafeInteger(tip) || tip < 0) throw new Error('RPC returned an invalid block count');

const genesisBlock = await rpc('getblock', ['0', 2]);
const tipHash = tip === 0 ? genesisHash : await rpc('getblockhash', [tip]);
const tipHeader = tip === 0 ? null : await rpc('getblockheader', [tipHash, true]).catch(() => null);

const branchCandidates = [
  blockchainInfo?.consensus?.nextblock,
  blockchainInfo?.consensus?.nextBlock,
  blockchainInfo?.consensus?.branchId,
  blockchainInfo?.consensusBranchId,
  tipHeader?.consensusBranchId,
  tipHeader?.branchId,
].map(branchIdFrom).filter(Boolean);
const observedBranch = branchCandidates[0] || null;
if (!observedBranch) {
  throw new Error(`Wcash consensus branch was not reported by the Wolf RPC for profile ${profile.id}`);
}
if (observedBranch !== profile.postGenesisBranchId) {
  throw new Error(`Wcash consensus branch mismatch: expected ${profile.postGenesisBranchId}, got ${observedBranch}`);
}

Object.assign(evidence, {
  reportedRpcChain: reportedChain || null,
  nodeSubversion: subversion || null,
  height: tip,
  tipHash: normalizeHash(tipHash),
  branchId: observedBranch,
  genesisBlock: {
    hash: normalizeHash(genesisBlock?.hash || genesisHash),
    height: Number(genesisBlock?.height ?? 0),
    size: Number(genesisBlock?.size || 0) || null,
    txCount: Array.isArray(genesisBlock?.tx) ? genesisBlock.tx.length : null,
  },
});

if (process.argv.includes('--capture-fixtures')) {
  const outputDir = path.resolve(argValue('--output-dir') || path.join(root, 'artifacts/wcashscan-validation'));
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `rpc-preflight-${profile.id}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
}

console.log(JSON.stringify(evidence, null, 2));
console.log(`Wcash RPC preflight passed: profile=${profile.id}, height=${tip}, genesis=${normalizeHash(genesisHash)}`);
