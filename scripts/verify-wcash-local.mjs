#!/usr/bin/env node

/**
 * Local WcashScan smoke test.
 *
 * This deliberately talks only to the local web/API origins. It verifies the
 * two frontend builds, the shared API contract, and the core dashboard routes.
 * A live Wolf/PostgreSQL requirement can be enabled with
 * WCASH_E2E_REQUIRE_LIVE=true.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profiles = JSON.parse(await readFile(path.join(root, 'config/wcash-networks.json'), 'utf8')).profiles;
const webTestnetUrl = process.env.TESTNET_WEB_URL || 'http://127.0.0.1:3000';
const webMainnetUrl = process.env.MAINNET_WEB_URL || 'http://127.0.0.1:3002';
const apiUrl = process.env.API_URL || process.env.WCASH_API_URL || 'http://127.0.0.1:3001';
const timeoutMs = Number(process.env.WCASH_E2E_TIMEOUT_MS || 8000);
const requireLive = process.env.WCASH_E2E_REQUIRE_LIVE === 'true';
const skipApi = process.env.WCASH_E2E_SKIP_API === 'true';
const expectedProfile = process.env.WCASH_EXPECTED_PROFILE || process.env.WCASH_CHAIN || 'wcash-testnet-v5';
const expected = profiles[expectedProfile];
if (!expected) fail(`unknown expected W.cash profile: ${expectedProfile}`);

const WEB_ROUTES = [
  '/',
  '/about',
  '/blocks',
  '/blocks/latest',
  '/charts',
  '/decrypt',
  '/docs',
  '/ironwood',
  '/learn',
  '/mempool',
  '/mempool/live',
  '/mining',
  '/network',
  '/network/nodes',
  '/newsletter',
  '/newsletter/rss',
  '/pools',
  '/press',
  '/privacy',
  '/privacy-policy',
  '/privacy-risks',
  '/privacy/wallets',
  '/reorgs',
  '/rich-list',
  '/robots.txt',
  '/sitemap.xml',
  '/terms',
  '/tools',
  '/tools/anchor-search',
  '/tools/blend-check',
  '/tools/broadcast',
  '/tools/decode',
  '/tools/unit-converter',
  '/turnstile',
  '/txs',
  '/txs/latest',
  '/txs/shielded',
  '/block/0',
  '/tx/0000000000000000000000000000000000000000000000000000000000000000',
];

const RETIRED_WEB_ROUTES = [
  '/bootstrap',
  '/crosschain',
  '/finalizer/example',
  '/fork-monitor',
  '/governance/nu7',
  '/learn/crosslink',
  '/validators',
];

const RETIRED_API_ROUTES = [
  '/api/crosslink',
  '/api/crosslink/bft-tip',
  '/api/crosslink/fork-monitor',
  '/api/finalizers',
];

const RETIRED_RENDERED_CONTENT = [
  /CipherScan/i,
  /cipherscan\.app/i,
  /CipherPay/i,
  /Zebrad/i,
  /CoinGecko/i,
  /Crosslink/i,
  /Zcash/i,
  /\bZEC\b/i,
  /\bTAZ\b/i,
  /\bCTAZ\b/i,
  /wcashexplorer\.com/i,
];

async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

function fail(message) {
  throw new Error(`[wcash-e2e] ${message}`);
}

async function assertPage(baseUrl, pathname, marker) {
  let result;
  try {
    result = await get(`${baseUrl}${pathname}`);
  } catch (error) {
    fail(`${baseUrl}${pathname} is unreachable: ${error.message}`);
  }
  if (result.response.status !== 200) {
    fail(`${baseUrl}${pathname} returned HTTP ${result.response.status}`);
  }
  if (marker && !result.body.includes(marker)) {
    fail(`${baseUrl}${pathname} did not contain ${JSON.stringify(marker)}`);
  }
  for (const pattern of RETIRED_RENDERED_CONTENT) {
    if (pattern.test(result.body)) {
      fail(`${baseUrl}${pathname} rendered retired or foreign content: ${pattern}`);
    }
  }
  return result;
}

async function assertStatus(baseUrl, pathname, expectedStatus) {
  let result;
  try {
    result = await get(`${baseUrl}${pathname}`);
  } catch (error) {
    fail(`${baseUrl}${pathname} is unreachable: ${error.message}`);
  }
  if (result.response.status !== expectedStatus) {
    fail(`${baseUrl}${pathname} returned HTTP ${result.response.status}; expected ${expectedStatus}`);
  }
}

async function main() {
  for (const page of WEB_ROUTES) {
    const marker = page === '/robots.txt' || page === '/sitemap.xml' ? null : 'WcashExplorer';
    await assertPage(webTestnetUrl, page, marker);
    await assertPage(webMainnetUrl, page, marker);
  }
  await assertPage(webTestnetUrl, '/', 'W.cash Testnet');
  for (const page of ['/', '/mining', '/network', '/pools']) {
    const preview = await assertPage(webMainnetUrl, page, 'Mainnet preview');
    if (!preview.body.includes('Mainnet preview — showing W.cash Testnet data. TWC has no monetary value.')) {
      fail(`${webMainnetUrl}${page} did not contain the exact Testnet-data preview warning`);
    }
  }
  for (const page of RETIRED_WEB_ROUTES) {
    await assertStatus(webTestnetUrl, page, 404);
    await assertStatus(webMainnetUrl, page, 404);
  }
  for (const page of ['/sitemaps/core', '/sitemaps/content', '/sitemaps/tools']) {
    await assertStatus(webTestnetUrl, page, 404);
    await assertStatus(webMainnetUrl, page, 200);
  }
  const previewHome = await get(`${webMainnetUrl}/`);
  if (!previewHome.body.includes('name="robots" content="noindex, follow"')) {
    fail(`${webMainnetUrl}/ must be noindex while it mirrors Testnet data`);
  }

  if (skipApi) {
    if (requireLive) fail('WCASH_E2E_SKIP_API=true cannot be combined with WCASH_E2E_REQUIRE_LIVE=true');
    console.log(JSON.stringify({
      ok: true,
      webTestnetUrl,
      webMainnetUrl,
      webRoutes: WEB_ROUTES.length,
      retiredWebRoutes: RETIRED_WEB_ROUTES.length,
      apiSkipped: true,
    }, null, 2));
    return;
  }

  let health;
  let config;
  try {
    health = await get(`${apiUrl}/health`);
    config = await get(`${apiUrl}/api/config`);
  } catch (error) {
    fail(`API is unreachable: ${error.message}`);
  }
  if (health.response.status !== 200) fail(`/health returned HTTP ${health.response.status}`);
  if (config.response.status !== 200) fail(`/api/config returned HTTP ${config.response.status}`);

  let configJson;
  try {
    configJson = JSON.parse(config.body);
  } catch {
    fail('/api/config did not return JSON');
  }
  if (configJson.success !== true) fail('/api/config did not report success');
  if (configJson.dataNetwork !== expectedProfile) {
    fail(`unexpected API data network: expected ${expectedProfile}, got ${configJson.dataNetwork}`);
  }
  if (configJson.genesisHash?.toLowerCase() !== expected.genesisHash.toLowerCase()) {
    fail(`unexpected API genesis: expected ${expected.genesisHash}, got ${configJson.genesisHash}`);
  }
  if (configJson.postGenesisBranchId?.toLowerCase() !== expected.postGenesisBranchId.toLowerCase()) {
    fail(`unexpected API branch: expected ${expected.postGenesisBranchId}, got ${configJson.postGenesisBranchId}`);
  }
  if (configJson.ticker !== 'TWC') fail(`unexpected API ticker: ${configJson.ticker}`);
  if (configJson.capabilities?.crosslink !== false) fail('Crosslink capability is not disabled');
  if (configJson.capabilities?.pricing !== false) fail('pricing capability is not disabled');
  for (const route of RETIRED_API_ROUTES) {
    await assertStatus(apiUrl, route, 404);
  }

  let deep;
  try {
    deep = await get(`${apiUrl}/health/deep`);
  } catch (error) {
    fail(`/health/deep is unreachable: ${error.message}`);
  }
  if (![200, 503].includes(deep.response.status)) {
    fail(`/health/deep returned unexpected HTTP ${deep.response.status}`);
  }
  if (requireLive && deep.response.status !== 200) {
    fail('/health/deep is not healthy; set WCASH_E2E_REQUIRE_LIVE=false for fixture-only smoke testing');
  }

  console.log(JSON.stringify({
    ok: true,
    webTestnetUrl,
    webMainnetUrl,
    apiUrl,
    webRoutes: WEB_ROUTES.length,
    retiredWebRoutes: RETIRED_WEB_ROUTES.length,
    retiredApiRoutes: RETIRED_API_ROUTES.length,
    apiDataNetwork: configJson.dataNetwork,
    apiStatus: configJson.status,
    deepHealthHttp: deep.response.status,
    requireLive,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
