const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { bech32m } = require('bech32');
const {
  isValidBase58CheckAddress,
  isValidUnifiedAddress,
  isValidWcashTexAddress,
} = require('../lib/zcash-address');

const WCASH_MAINNET_UA = 'wu1fup0tyn04mp2hktdx25hk6tvh4gm8me04egwhdtycdxqvsphl5dna89ghj3j3gahlxsqxdy35vezp2r7xzvmcx4cs2p9c5yqsswmrjwq';
const WCASH_TESTNET_UA = 'wutest12ky95e9c6mu3qveefsekul4tk949ahkllsu8yglndurppu8j8qeleyd20r7z6jaacwhnwar5wlrmw0nynugqr2yldvc9cv9y9gfktz8k';
const WCASH_REGTEST_UA = 'wuregtest1ctr282fk80mmwz0t69s4kywtstpyh0lr23u6ynpy54m7lufs0qyrautm3kjg7sxk5mu0lp0ck4hea672xhvrdzz2863afkz6ss423hgj';
const ZCASH_UA = 'u1fh3kwyl9hq9q907rx9j8mdy2r7gz4xh0y4yt63dxykk2856gr0238vxsegemyfu8s5a77ycq72tcnzkxa75ykjtcn6wp2w9rtuu3ssdzpe2fyghl8wlk3vh6f67304xe4lrxtvywtudy5t434zc07u6mh27ekufx7ssr55l8875z7f4k76c3tk23s3jzf8rxdlkequlta8lwsv09gxm';

test('accepts W.cash Unified Addresses with F4Jumble and Ironwood receiver data', () => {
  assert.equal(isValidUnifiedAddress(WCASH_MAINNET_UA), true);
  assert.equal(isValidUnifiedAddress(WCASH_TESTNET_UA), true);
  assert.equal(isValidUnifiedAddress(WCASH_REGTEST_UA), true);
});

test('rejects wrong-network, corrupted, and structurally incomplete Unified Addresses', () => {
  assert.equal(isValidUnifiedAddress(ZCASH_UA), false);
  assert.equal(isValidUnifiedAddress(`${WCASH_TESTNET_UA.slice(0, -1)}q`), false);
  assert.equal(isValidUnifiedAddress(WCASH_TESTNET_UA.toUpperCase()), false);
  const incomplete = bech32m.encode('wutest', bech32m.toWords(Buffer.alloc(43)));
  assert.equal(isValidUnifiedAddress(incomplete), false);
});

test('validates W.cash TEX addresses as exactly 20-byte Bech32m payloads', () => {
  const valid = bech32m.encode('wtextest', bech32m.toWords(Buffer.alloc(20)));
  assert.equal(isValidWcashTexAddress(valid), true);
  assert.equal(isValidWcashTexAddress(`${valid.slice(0, -1)}q`), false);
  assert.equal(isValidWcashTexAddress(bech32m.encode('utest', bech32m.toWords(Buffer.alloc(20)))), false);
});

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encodeBase58Check(payload) {
  const checksum = crypto.createHash('sha256')
    .update(crypto.createHash('sha256').update(payload).digest())
    .digest()
    .subarray(0, 4);
  const bytes = Buffer.concat([payload, checksum]);
  let value = BigInt(`0x${bytes.toString('hex')}`);
  let encoded = '';
  while (value > 0n) {
    encoded = BASE58_ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = `1${encoded}`;
  }
  return encoded;
}

test('validates W.cash transparent Base58Check version bytes and checksum', () => {
  assert.equal(isValidBase58CheckAddress('W1M7uk1EZYGQGJCwCL5cWTE1FU5CuVSL6bU'), true);
  assert.equal(isValidBase58CheckAddress('WT6kWkxJzyp4LdwrjtvvuVFRbkMhH2SsBeq'), true);
  assert.equal(isValidBase58CheckAddress('WR64VqQpZRujxYnAJmqGK4d4fbqQZRZHazG'), true);

  const zcashAddress = encodeBase58Check(Buffer.from('1cb8'.padEnd(44, '0'), 'hex'));
  assert.equal(isValidBase58CheckAddress(zcashAddress), false);
  assert.equal(isValidBase58CheckAddress('t1not-a-real-zcash-address'), false);
  assert.equal(isValidBase58CheckAddress('WT6kWkxJzyp4LdwrjtvvuVFRbkMhH2SsBeq1'), false);
  assert.equal(
    isValidBase58CheckAddress(encodeBase58Check(Buffer.from('0000'.padEnd(44, '0'), 'hex'))),
    false,
  );
});
