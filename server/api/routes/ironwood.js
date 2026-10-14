'use strict';

const express = require('express');
const router = express.Router();
const { getWcashProfile } = require('../lib/wcash-profile');

router.get('/api/ironwood/overview', async (req, res) => {
  let profile;
  try {
    profile = getWcashProfile();
  } catch {
    return res.status(500).json({ success: false, error: 'Invalid W.cash profile' });
  }

  if (!profile.capabilities.ironwood) {
    return res.status(404).json({ success: false, error: 'Ironwood is not enabled for this profile' });
  }

  const pool = req.app.locals.pool;
  const callZebraRPC = req.app.locals.callZebraRPC;
  let indexed = {
    height: 0,
    ironwoodTransactions: 0,
    ironwoodActions: 0,
    latestActivityHeight: null,
  };

  try {
    const result = await pool.query(`
      SELECT
        COALESCE(MAX(block_height), 0) AS indexed_height,
        COUNT(*) FILTER (WHERE has_ironwood = true) AS ironwood_transactions,
        COALESCE(SUM(ironwood_actions), 0) AS ironwood_actions,
        MAX(block_height) FILTER (WHERE has_ironwood = true) AS latest_activity_height
      FROM transactions
    `);
    const row = result.rows[0] || {};
    indexed = {
      height: Number(row.indexed_height) || 0,
      ironwoodTransactions: Number(row.ironwood_transactions) || 0,
      ironwoodActions: Number(row.ironwood_actions) || 0,
      latestActivityHeight: row.latest_activity_height == null ? null : Number(row.latest_activity_height),
    };
  } catch {
    // An empty or not-yet-migrated database is a valid local bootstrap state.
  }

  let node = null;
  if (typeof callZebraRPC === 'function') {
    try {
      const info = await callZebraRPC('getblockchaininfo');
      const poolInfo = Array.isArray(info?.valuePools)
        ? info.valuePools.find((valuePool) => valuePool.id === 'ironwood')
        : null;
      node = {
        height: Number(info?.blocks) || null,
        pool: poolInfo
          ? {
              chainValue: poolInfo.chainValue ?? null,
              chainValueZat: poolInfo.chainValueZat ?? null,
              monitored: poolInfo.monitored ?? null,
            }
          : null,
        source: 'wolf-rpc',
      };
    } catch {
      node = null;
    }
  }

  res.json({
    success: true,
    network: profile.id,
    ticker: profile.ticker,
    activationHeight: 1,
    pool: node?.pool || null,
    indexed,
    node,
    source: {
      activity: 'PostgreSQL transactions written by server/wcash-indexer',
      poolBalance: node ? 'W.cash Wolf JSON-RPC' : 'unavailable',
    },
    generatedAt: new Date().toISOString(),
  });
});

module.exports = router;
