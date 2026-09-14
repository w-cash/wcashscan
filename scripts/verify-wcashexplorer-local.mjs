#!/usr/bin/env node

const baseUrl = (process.env.WCASHEXPLORER_LOCAL_URL || 'http://localhost:3000').replace(/\/+$/, '');
const routes = [
  '/',
  '/blocks',
  '/blocks/latest',
  '/txs',
  '/txs/latest',
  '/txs/shielded',
  '/network',
  '/network/nodes',
  '/charts',
  '/mempool',
  '/mempool/live',
  '/pools',
  '/privacy',
  '/privacy-risks',
  '/mining',
  '/rich-list',
  '/reorgs',
  '/crosschain',
  '/ironwood',
  '/turnstile',
  '/usage-clock',
  '/validators',
  '/valuation',
  '/tools',
  '/tools/blend-check',
  '/tools/decode',
  '/tools/unit-converter',
  '/docs',
  '/learn',
  '/about',
];

const failures = [];
for (const route of routes) {
  try {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    if (response.status !== 200) {
      failures.push(`${route} → HTTP ${response.status}`);
      continue;
    }
    const body = await response.text();
    if (!body.includes('WcashExplorer')) {
      failures.push(`${route} → response is missing the WcashExplorer shell`);
      continue;
    }
    if (/Application error|Internal Server Error/i.test(body)) {
      failures.push(`${route} → response contains a server-rendered error`);
      continue;
    }
    console.log(`OK  ${route}`);
  } catch (error) {
    failures.push(`${route} → ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} local route checks failed:`);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nWcashExplorer local route smoke passed: ${routes.length}/${routes.length}`);
}
