const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const router = require('../routes/scan');

test('wallet scan compatibility routes are explicitly disabled for W.cash', async t => {
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());

  for (const pathname of ['/api/lightwalletd/scan', '/api/scan/orchard']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startHeight: 1, endHeight: 2 }),
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      success: false,
      code: 'WALLET_SCAN_DISABLED',
      feature: pathname === '/api/scan/orchard' ? 'legacy-wallet-scan' : 'lightwalletd-wallet-scan',
      error: 'Wallet scanning is disabled for this W.cash explorer deployment',
      available: false,
    });
  }
});
