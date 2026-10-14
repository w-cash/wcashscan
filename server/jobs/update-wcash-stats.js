#!/usr/bin/env node

/**
 * Refresh W.cash-only privacy/activity aggregates.
 *
 * The schema retains a few legacy columns for migration compatibility, but
 * this job reads and writes only transparent and Ironwood values. It is the
 * source for /api/privacy-stats and the daily gallery series.
 */

const { getPool, getReadPool } = require('../lib/db-pool');
const { callWcashRPC } = require('../lib/zebra-rpc');
const { getWcashProfile } = require('../api/lib/wcash-profile');
const { log, loadEnv, withAdvisoryLock } = require('../lib/job-utils');

loadEnv(__dirname);

const writePool = getPool({ max: 2 });
const readPool = getReadPool({ max: 2 });
const LOCK_ID = 8_392_710;
const ZAT_PER_TWC = 100_000_000;

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function poolValue(valuePools, id) {
  const row = (valuePools || []).find((item) => item.id === id);
  if (!row) return null;
  const value = row.chainValueZat ?? row.chainValue;
  if (value == null) return null;
  // Wolf normally supplies chainValueZat. chainValue is accepted only as a
  // whole-coin fallback and is converted exactly enough for a stats snapshot.
  return row.chainValueZat != null ? BigInt(String(value)) : BigInt(Math.round(Number(value) * ZAT_PER_TWC));
}

async function assertWcashNode() {
  const profile = getWcashProfile(process.env.WCASH_CHAIN || 'wcash-testnet-v5');
  const genesis = await callWcashRPC('getblockhash', [0]);
  if (genesis !== profile.genesisHash) {
    throw new Error(`W.cash genesis mismatch: expected ${profile.genesisHash}, got ${genesis}`);
  }
  return callWcashRPC('getblockchaininfo');
}

function derivePoolSnapshot(info) {
  const transparent = poolValue(info.valuePools, 'transparent');
  const ironwood = poolValue(info.valuePools, 'ironwood');
  if (transparent == null || ironwood == null) {
    throw new Error('W.cash RPC did not return transparent and ironwood value pools');
  }
  const chainSupply = info.chainSupply?.chainValueZat != null
    ? BigInt(String(info.chainSupply.chainValueZat))
    : null;
  if (chainSupply == null) {
    throw new Error('W.cash RPC did not return an authoritative chain supply');
  }
  return {
    transparent,
    ironwood,
    chainSupply,
    latestBlock: number(info.blocks ?? info.height),
    latestHash: info.bestblockhash || null,
  };
}

async function readCanonicalSnapshot(stats) {
  if (!Number.isSafeInteger(stats.latestBlock) || stats.latestBlock < 0 || !stats.latestHash) {
    throw new Error('W.cash indexed tip is not available for aggregate publication');
  }
  const result = await readPool.query(`
    SELECT height, block_hash, cumulative_issuance_zat,
           transparent_balance_zat, ironwood_balance_zat
    FROM wcash_block_metrics
    WHERE height=$1 AND block_hash=$2
  `, [stats.latestBlock, stats.latestHash]);
  const row = result.rows[0];
  if (!row) throw new Error('W.cash canonical metric is missing for the indexed tip');
  return {
    transparent: BigInt(String(row.transparent_balance_zat)),
    ironwood: BigInt(String(row.ironwood_balance_zat)),
    chainSupply: BigInt(String(row.cumulative_issuance_zat)),
    latestBlock: Number(row.height),
    latestHash: row.block_hash,
  };
}

async function readTransactionStats() {
  const totals = (await readPool.query(`
    SELECT
      COUNT(*)::bigint AS total_transactions,
      COUNT(*) FILTER (WHERE is_coinbase)::bigint AS coinbase_count,
      COUNT(*) FILTER (WHERE has_ironwood AND NOT is_coinbase)::bigint AS shielded_count,
      COUNT(*) FILTER (WHERE NOT is_coinbase AND NOT has_ironwood)::bigint AS transparent_count,
      COUNT(*) FILTER (WHERE has_ironwood AND NOT is_coinbase AND vin_count > 0 AND vout_count > 0)::bigint AS mixed_count,
      COUNT(*) FILTER (WHERE has_ironwood AND NOT is_coinbase AND vin_count = 0 AND vout_count = 0)::bigint AS fully_shielded_count,
      MAX(block_height)::bigint AS latest_block
    FROM transactions
    WHERE block_height >= 0
  `)).rows[0] || {};

  const recent = (await readPool.query(`
    SELECT COUNT(*) FILTER (WHERE has_ironwood AND NOT is_coinbase)::bigint AS count
    FROM transactions
    WHERE block_time >= EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')
  `)).rows[0] || {};

  const previous = (await readPool.query(`
    SELECT
      COUNT(*) FILTER (WHERE has_ironwood AND NOT is_coinbase AND block_time >= EXTRACT(EPOCH FROM NOW() - INTERVAL '14 days'))::bigint AS recent,
      COUNT(*) FILTER (WHERE has_ironwood AND NOT is_coinbase AND block_time >= EXTRACT(EPOCH FROM NOW() - INTERVAL '28 days') AND block_time < EXTRACT(EPOCH FROM NOW() - INTERVAL '14 days'))::bigint AS previous
    FROM transactions
  `)).rows[0] || {};
  const latest = (await readPool.query(
    'SELECT height, hash FROM blocks ORDER BY height DESC LIMIT 1'
  )).rows[0] || {};

  const totalTx = number(totals.total_transactions);
  const shieldedTx = number(totals.shielded_count);
  const recentCount = number(previous.recent);
  const previousCount = number(previous.previous);
  const delta = previousCount > 0 ? (recentCount - previousCount) / previousCount : 0;

  return {
    totalBlocks: number((await readPool.query('SELECT COUNT(*)::bigint AS count FROM blocks')).rows[0]?.count),
    totalTx,
    shieldedTx,
    transparentTx: number(totals.transparent_count),
    coinbaseTx: number(totals.coinbase_count),
    mixedTx: number(totals.mixed_count),
    fullyShieldedTx: number(totals.fully_shielded_count),
    latestBlock: number(latest.height ?? totals.latest_block),
    latestHash: latest.hash || null,
    shieldedPercentage: totalTx > 0 ? (shieldedTx / totalTx) * 100 : 0,
    avgShieldedPerDay: number(recent.count) / 30,
    adoptionTrend: delta > 0.1 ? 'growing' : delta < -0.1 ? 'declining' : 'stable',
  };
}

function scoreFor(stats) {
  // This is deliberately a descriptive activity share, not a claim that the
  // chain's privacy can be measured from public metadata alone.
  return Math.max(0, Math.min(100, Math.round(stats.shieldedPercentage)));
}

async function upsertStats(snapshot, stats) {
  const score = scoreFor(stats);
  const breakdown = JSON.stringify({
    ironwoodTransactionShare: stats.shieldedPercentage,
    source: 'indexed W.cash transactions',
    interpretation: 'activity share only',
  });
  const latest = await writePool.query('SELECT id FROM privacy_stats ORDER BY updated_at DESC LIMIT 1');
  const values = [
    stats.totalBlocks, stats.totalTx, stats.shieldedTx, stats.transparentTx,
    stats.coinbaseTx, stats.mixedTx, stats.fullyShieldedTx, snapshot.ironwood.toString(),
    snapshot.ironwood.toString(), snapshot.transparent.toString(), stats.shieldedPercentage,
    score, stats.avgShieldedPerDay, stats.adoptionTrend, stats.latestBlock,
    snapshot.transparent.toString(), snapshot.chainSupply.toString(), snapshot.ironwood.toString(),
    breakdown, stats.latestBlock, stats.latestHash,
  ];

  // The inherited schema has no uniqueness constraint on privacy_stats. Read
  // first, insert only on an empty database, and update that single current
  // row thereafter so every scheduler tick remains idempotent.
  if (!latest.rows[0]) {
    await writePool.query(`
      INSERT INTO privacy_stats (
        total_blocks, total_transactions, shielded_tx, transparent_tx,
        coinbase_tx, mixed_tx, fully_shielded_tx, shielded_pool_size,
        total_shielded, total_unshielded, shielded_percentage, privacy_score,
        avg_shielded_per_day, adoption_trend, last_block_scanned,
        sprout_pool_size, sapling_pool_size, orchard_pool_size,
        transparent_pool_size, chain_supply, ironwood_pool_size,
        privacy_score_breakdown, source_block_height, source_block_hash, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,0,0,0,$16,$17,$18,$19,$20,$21,NOW())
    `, values);
  } else {
    await writePool.query(`
      UPDATE privacy_stats SET
        total_blocks=$1,total_transactions=$2,shielded_tx=$3,transparent_tx=$4,
        coinbase_tx=$5,mixed_tx=$6,fully_shielded_tx=$7,shielded_pool_size=$8,
        total_shielded=$9,total_unshielded=$10,shielded_percentage=$11,
        privacy_score=$12,avg_shielded_per_day=$13,adoption_trend=$14,
        last_block_scanned=$15,sprout_pool_size=0,sapling_pool_size=0,
        orchard_pool_size=0,transparent_pool_size=$16,chain_supply=$17,
        ironwood_pool_size=$18,privacy_score_breakdown=$19::jsonb,
        source_block_height=$20,source_block_hash=$21,updated_at=NOW()
      WHERE id=$22
    `, [...values, latest.rows[0].id]);
  }
}

async function upsertDaily(snapshot, stats) {
  const date = new Date().toISOString().slice(0, 10);
  const score = scoreFor(stats);
  const day = await readPool.query(`
    SELECT
      COUNT(*) FILTER (WHERE has_ironwood AND NOT is_coinbase)::bigint AS shielded,
      COUNT(*) FILTER (WHERE NOT is_coinbase AND NOT has_ironwood)::bigint AS transparent
    FROM transactions
    WHERE block_time >= EXTRACT(EPOCH FROM $1::date)
      AND block_time < EXTRACT(EPOCH FROM ($1::date + INTERVAL '1 day'))
  `, [date]);
  const row = day.rows[0] || {};
  const shielded = number(row.shielded);
  const transparent = number(row.transparent);
  const total = shielded + transparent;

  await writePool.query(`
    INSERT INTO privacy_trends_daily
      (date, shielded_count, transparent_count, shielded_percentage, pool_size,
       privacy_score, sprout_pool_size, sapling_pool_size, orchard_pool_size,
       ironwood_pool_size, transparent_pool_size, chain_supply,
       source_block_height, source_block_hash)
    VALUES ($1,$2,$3,$4,$5,$6,0,0,0,$7,$8,$9,$10,$11)
    ON CONFLICT (date) DO UPDATE SET
      shielded_count=EXCLUDED.shielded_count,
      transparent_count=EXCLUDED.transparent_count,
      shielded_percentage=EXCLUDED.shielded_percentage,
      pool_size=EXCLUDED.pool_size,
      privacy_score=EXCLUDED.privacy_score,
      sprout_pool_size=0,sapling_pool_size=0,orchard_pool_size=0,
      ironwood_pool_size=EXCLUDED.ironwood_pool_size,
      transparent_pool_size=EXCLUDED.transparent_pool_size,
      chain_supply=EXCLUDED.chain_supply,
      source_block_height=EXCLUDED.source_block_height,
      source_block_hash=EXCLUDED.source_block_hash
  `, [
    date, shielded, transparent, total ? (shielded / total) * 100 : 0,
    snapshot.ironwood.toString(), score, snapshot.ironwood.toString(),
    snapshot.transparent.toString(), snapshot.chainSupply.toString(),
    stats.latestBlock, stats.latestHash,
  ]);
}

async function run() {
  const client = await writePool.connect();
  try {
    await withAdvisoryLock(client, LOCK_ID, async () => {
      await assertWcashNode();
      const stats = await readTransactionStats();
      // The node may advance while the indexer is catching up. Publish pool
      // balances at the indexed canonical height, never current-tip values
      // relabelled as older history.
      const snapshot = await readCanonicalSnapshot(stats);
      await upsertStats(snapshot, stats);
      await upsertDaily(snapshot, stats);
      log(`W.cash stats updated at height ${snapshot.latestBlock}: ${stats.totalTx} transactions`);
    });
  } finally {
    client.release();
    await Promise.all([writePool.end(), readPool.end()]);
  }
}

if (require.main === module) run().catch((error) => { log(`ERROR: ${error.message}`); process.exitCode = 1; });

module.exports = { derivePoolSnapshot, readCanonicalSnapshot, scoreFor, readTransactionStats, run };
