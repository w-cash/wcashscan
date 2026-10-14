'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getWcashProfile,
  getPublicWcashConfig,
  assertGenesisHash,
} = require('../api/lib/wcash-profile');
const { bech32m } = require('bech32');
const {
  isValidUnifiedAddress,
  isValidWcashTexAddress,
  isValidBase58CheckAddress,
} = require('../api/lib/zcash-address');

test('Wcash Testnet profile is the default public data identity', () => {
  const profile = getWcashProfile('wcash-testnet-v5');

  assert.equal(profile.ticker, 'TWC');
  assert.equal(profile.chain, 'WcashTestnet');
  assert.equal(profile.genesisHash, '0271b5b0a10b2838f43cccdec9ca2f72aa72a7c103830082bac8f82f47f0593a');
  assert.equal(profile.postGenesisBranchId, 'b3cfd27e');
  assert.equal(profile.targetSpacingSeconds, 75);
  assert.equal(profile.capabilities.crosslink, false);
  assert.equal(profile.capabilities.pricing, false);
  assert.equal(profile.capabilities.walletScan, false);
});

test('public config carries source and capability data without secrets', () => {
  const config = getPublicWcashConfig({
    indexed: { height: 12, hash: 'abc', source: 'postgresql' },
    node: { height: 12, genesisStatus: 'match', source: 'wolf-rpc' },
    status: 'healthy',
  });

  assert.equal(config.dataNetwork, 'wcash-testnet-v5');
  assert.equal(config.ticker, 'TWC');
  assert.equal(config.status, 'healthy');
  assert.equal(config.capabilities.crosslink, false);
  assert.equal('rpcUrl' in config, false);
  assert.equal('password' in config, false);
});

test('genesis validation fails closed for a wrong chain', () => {
  const profile = getWcashProfile('wcash-testnet-v5');

  assert.doesNotThrow(() => assertGenesisHash(profile.genesisHash, profile));
  assert.throws(
    () => assertGenesisHash('0000000000000000000000000000000000000000000000000000000000000000', profile),
    /genesis mismatch/i,
  );
});

test('Wcash address namespaces accept Wcash encodings and reject Zcash encodings', () => {
  const unified = 'wutest12ky95e9c6mu3qveefsekul4tk949ahkllsu8yglndurppu8j8qeleyd20r7z6jaacwhnwar5wlrmw0nynugqr2yldvc9cv9y9gfktz8k';
  const tex = bech32m.encode('wtextest', bech32m.toWords(Buffer.alloc(20, 8)));

  assert.equal(isValidUnifiedAddress('wutest1invalid'), false);
  assert.equal(isValidUnifiedAddress(unified), true);
  assert.equal(isValidWcashTexAddress(tex), true);
  assert.equal(isValidWcashTexAddress(`${tex}x`), false);
  assert.equal(isValidBase58CheckAddress('t1ZcashAddressMustNotBeAccepted'), false);
  assert.ok(unified.startsWith('wutest1'));
});
