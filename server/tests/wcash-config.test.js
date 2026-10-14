'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const configRouter = require('../api/routes/config');
const { getWcashProfile } = require('../api/lib/wcash-profile');

test('public config treats a genesis-only indexed database as a real height-0 tip', async t => {
  const previousChain = process.env.WCASH_CHAIN;
  process.env.WCASH_CHAIN = 'wcash-testnet-v5';
  const profile = getWcashProfile('wcash-testnet-v5');
  const app = express();
  app.locals.chainTip = { height: 0, hash: profile.genesisHash };
  app.locals.writePool = {
    query: async (sql) => sql.includes('wcash_chain_identity') ? { rows: [] } : { rows: [] },
  };
  app.locals.callZebraRPC = async (method) => {
    if (method === 'getblockchaininfo') {
      return { chain: 'test', blocks: 0, subversion: '/Wolf:0.1.0/' };
    }
    if (method === 'getblockcount') return 0;
    if (method === 'getblockhash') return profile.genesisHash;
    throw new Error(`unexpected RPC method ${method}`);
  };
  app.use(configRouter);

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => {
    server.close();
    if (previousChain === undefined) delete process.env.WCASH_CHAIN;
    else process.env.WCASH_CHAIN = previousChain;
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/config`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'healthy');
  assert.deepEqual(body.indexed, { height: 0, hash: profile.genesisHash, source: 'api-memory' });
  assert.equal(body.node.height, 0);
  assert.equal(body.node.genesisStatus, 'match');
  assert.equal(body.source.node, 'W.cash Wolf');
  assert.equal('rpcUrl' in body, false);
});
