#!/usr/bin/env node

const rpcUrl = (process.env.WCASH_REGTEST_RPC_URL || 'http://127.0.0.1:48232').replace(/\/+$/, '');

// The local Wcash regtest profile has a fixed genesis. Allow an override so a
// freshly-created profile can be checked without changing this script.
const expectedGenesis = (
  process.env.WCASH_EXPECTED_GENESIS_HASH ||
  '70bf0bab17eff361a6331bb825b3b7253c8c96ff96407f948161d2912658bb1c'
).toLowerCase();

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(`${method} returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
  if (payload.error) {
    throw new Error(`${method} RPC error ${payload.error.code}: ${payload.error.message}`);
  }
  return payload.result;
}

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const [chainInfo, networkInfo] = await Promise.all([
    rpc('getblockchaininfo'),
    rpc('getnetworkinfo'),
  ]);
  const chain = String(chainInfo?.chain || '').toLowerCase();
  const subversion = String(networkInfo?.subversion || '');

  requireCheck(['test', 'regtest'].includes(chain), `unexpected Wcash local chain label: ${chain || 'missing'}`);
  requireCheck(/Wcash/i.test(subversion), `RPC node does not identify as Wcash: ${subversion || 'missing version'}`);

  const [height, genesis, bestBlockHash, mempool] = await Promise.all([
    rpc('getblockcount'),
    rpc('getblockhash', [0]),
    rpc('getbestblockhash'),
    rpc('getmempoolinfo'),
  ]);
  requireCheck(Number.isInteger(height) && height >= 1, `chain tip height is invalid: ${height}`);
  requireCheck(String(genesis).toLowerCase() === expectedGenesis, 'genesis hash does not match the Wcash local profile');

  const tip = await rpc('getblock', [bestBlockHash, 1]);
  requireCheck(tip?.hash === bestBlockHash, 'getblock returned a different best-block hash');
  requireCheck(tip?.height === height, `best block height ${tip?.height} does not match getblockcount ${height}`);
  requireCheck(Number.isInteger(mempool?.size) && mempool.size >= 0, 'mempool response is invalid');

  console.log(
    `Wcash local regtest RPC passed: chain=${chain}, height=${height}, ` +
      `version=${subversion}, mempool=${mempool.size}`,
  );
} catch (error) {
  console.error(`Wcash local regtest RPC check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
