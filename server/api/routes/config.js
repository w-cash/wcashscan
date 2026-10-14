/**
 * W.cash configuration and source-of-truth endpoint.
 *
 * This is intentionally read-only. It tells the browser which chain the API
 * serves and whether the node/indexer/database are currently available. It
 * does not expose RPC credentials or make the browser a direct RPC client.
 */

const express = require('express');
const router = express.Router();
const {
  getConfiguredDataNetwork,
  getWcashProfile,
  getPublicWcashConfig,
  assertGenesisHash,
} = require('../lib/wcash-profile');

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function readIndexedTip(req) {
  const localTip = req.app.locals.chainTip;
  const localHeight = Number(localTip?.height);
  if (localTip && Number.isSafeInteger(localHeight) && localHeight >= 0) {
    return { height: localHeight, hash: localTip.hash || null, source: 'api-memory' };
  }

  const pool = req.app.locals.writePool || req.app.locals.pool;
  if (!pool?.query) return null;

  try {
    const result = await withTimeout(
      pool.query('SELECT height, hash FROM blocks ORDER BY height DESC LIMIT 1'),
      2500
    );
    const row = result?.rows?.[0];
    if (!row) return null;
    return { height: Number(row.height), hash: row.hash || null, source: 'postgresql' };
  } catch {
    return null;
  }
}

async function readDatabaseIdentity(req, profile) {
  const pool = req.app.locals.writePool || req.app.locals.pool;
  if (!pool?.query) return { present: false, matches: false };
  try {
    const result = await withTimeout(pool.query(`
      SELECT chain, ticker, genesis_hash, post_genesis_branch_id, schema_version,
             target_spacing_seconds, halving_interval, monetary_ceiling_zatoshi
      FROM wcash_chain_identity
      WHERE profile_id = $1
    `, [profile.id]), 2500);
    const row = result?.rows?.[0];
    if (!row) return { present: false, matches: false };
    const matches = row.chain === profile.chain
      && row.ticker === profile.ticker
      && String(row.genesis_hash).toLowerCase() === profile.genesisHash.toLowerCase()
      && String(row.post_genesis_branch_id).toLowerCase() === profile.postGenesisBranchId.toLowerCase()
      && Number(row.schema_version) === 1
      && Number(row.target_spacing_seconds) === profile.targetSpacingSeconds
      && Number(row.halving_interval) === profile.halvingInterval
      && String(row.monetary_ceiling_zatoshi) === profile.monetaryCeilingZatoshi;
    return { present: true, matches, profileId: profile.id, schemaVersion: Number(row.schema_version) };
  } catch {
    return { present: false, matches: false };
  }
}

async function readNodeStatus(req, profile) {
  const callZebraRPC = req.app.locals.callZebraRPC;
  if (typeof callZebraRPC !== 'function') return null;

  const [info, height, genesis] = await Promise.all([
    withTimeout(callZebraRPC('getblockchaininfo').catch(() => null), 3000),
    withTimeout(callZebraRPC('getblockcount').catch(() => null), 3000),
    withTimeout(callZebraRPC('getblockhash', [0]).catch(() => null), 3000),
  ]);

  if (info === null && height === null && genesis === null) return null;

  const actualGenesis = typeof genesis === 'string'
    ? genesis
    : (info?.chainwork?.genesisHash || info?.genesisHash || null);
  let genesisStatus = 'not_reported';
  if (actualGenesis) {
    try {
      assertGenesisHash(actualGenesis, profile);
      genesisStatus = 'match';
    } catch {
      genesisStatus = 'mismatch';
    }
  }

  return {
    chain: info?.chain || profile.rpcChain,
    height: numberOrNull(height ?? info?.blocks),
    subversion: info?.subversion || null,
    connections: numberOrNull(info?.connections),
    verificationProgress: numberOrNull(info?.verificationprogress),
    genesisHash: actualGenesis,
    genesisStatus,
    source: 'wolf-rpc',
  };
}

router.get('/api/config', async (req, res) => {
  let profile;
  try {
    profile = getWcashProfile(getConfiguredDataNetwork());
  } catch {
    res.status(500).json({ success: false, error: 'Invalid Wcash network configuration' });
    return;
  }

  const [indexed, node, databaseIdentity] = await Promise.all([
    readIndexedTip(req),
    readNodeStatus(req, profile),
    readDatabaseIdentity(req, profile),
  ]);

  const genesisMismatch = node?.genesisStatus === 'mismatch';
  const identityMismatch = databaseIdentity.present && !databaseIdentity.matches;
  const hasNode = Boolean(node);
  const hasIndexedData = Boolean(
    indexed && Number.isSafeInteger(Number(indexed.height)) && Number(indexed.height) >= 0,
  );
  const status = genesisMismatch || identityMismatch
    ? 'misconfigured'
    : hasNode && hasIndexedData
      ? 'healthy'
      : hasNode || hasIndexedData
        ? 'degraded'
        : 'unavailable';

  const config = getPublicWcashConfig({
    indexed,
    node,
    databaseIdentity,
    status,
  });

  res.json({
    success: true,
    ...config,
    source: {
      browser: 'WcashExplorer API',
      api: 'server/api',
      node: 'W.cash Wolf',
      indexer: 'server/wcash-indexer',
      database: 'PostgreSQL',
      cache: 'Redis (optional)',
    },
    mainnetPreview: process.env.NEXT_PUBLIC_NETWORK === 'mainnet' || process.env.WCASH_MAINNET_PREVIEW === 'true',
    generatedAt: new Date().toISOString(),
  });
});

module.exports = router;
