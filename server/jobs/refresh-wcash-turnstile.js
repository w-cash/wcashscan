#!/usr/bin/env node

/**
 * W.cash public boundary observations.
 *
 * This is intentionally a small replacement for the inherited exchange/
 * bridge-oriented turnstile job. It records only what the indexed public
 * ledger can prove: Ironwood deshields, whether a transparent destination was
 * observed, and whether that output was later spent or reshielded. Exchange,
 * bridge and ownership labels remain zero/unavailable.
 */

const { getPool } = require('../lib/db-pool');
const { log, loadEnv, withAdvisoryLock } = require('../lib/job-utils');

loadEnv(__dirname);

const pool = getPool({ max: 2 });
const LOCK_ID = 8_392_714;
const STATE_KEY = 'wcash_turnstile_last_processed_time';
const REBUILD = process.env.WCASH_TURNSTILE_REBUILD === '1';
const RECENT_DAYS = 7;
const MAX_AUTO_DATES = 31;

async function getBookmark(client) {
  const result = await client.query('SELECT value FROM indexer_state WHERE key=$1', [STATE_KEY]);
  return Number(result.rows[0]?.value || 0) || 0;
}

async function setBookmark(client, value) {
  await client.query(`
    INSERT INTO indexer_state (key,value,updated_at) VALUES ($1,$2,NOW())
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()
  `, [STATE_KEY, String(value)]);
}

async function datesToProcess(client, bookmark) {
  const result = await client.query(`
    SELECT DISTINCT DATE(TO_TIMESTAMP(block_time)) AS date
    FROM shielded_flows
    WHERE pool='ironwood' AND flow_type='deshield' AND block_time > $1
    ORDER BY date
  `, [bookmark]);
  const dates = result.rows.map((row) => String(row.date));
  if (!REBUILD && dates.length > MAX_AUTO_DATES) {
    log(`W.cash turnstile: limiting ${dates.length} new dates to the newest ${MAX_AUTO_DATES}; use backfill for a full rebuild`);
    return dates.slice(-MAX_AUTO_DATES);
  }
  if (REBUILD) {
    const all = await client.query(`
      SELECT DISTINCT DATE(TO_TIMESTAMP(block_time)) AS date
      FROM shielded_flows
      WHERE pool='ironwood' AND flow_type='deshield'
      ORDER BY date
    `);
    return all.rows.map((row) => String(row.date));
  }
  const recent = await client.query(`
    SELECT DISTINCT date::text AS date
    FROM turnstile_daily
    WHERE pool='ironwood' AND held_zat > 0
      AND date >= CURRENT_DATE - $1::int
  `, [RECENT_DAYS]);
  return [...new Set([...dates, ...recent.rows.map((row) => String(row.date))])].sort();
}

async function sourceForDate(client, date) {
  const result = await client.query(`
    SELECT block_height, block_hash
    FROM blocks
    WHERE height = (
      SELECT MAX(block_height) FROM shielded_flows
      WHERE pool='ironwood' AND flow_type='deshield'
        AND DATE(TO_TIMESTAMP(block_time)) = $1::date
    )
  `, [date]);
  return {
    height: result.rows[0]?.block_height == null ? null : Number(result.rows[0].block_height),
    hash: result.rows[0]?.block_hash || null,
  };
}

async function recomputeDate(client, date) {
  const aggregate = await client.query(`
    WITH deshields AS MATERIALIZED (
      SELECT sf.txid, sf.amount_zat,
        EXISTS (
          SELECT 1 FROM transaction_outputs destination
          WHERE destination.txid=sf.txid AND destination.address IS NOT NULL
        ) AS has_public_destination,
        EXISTS (
          SELECT 1
          FROM transaction_inputs spend
          JOIN shielded_flows reshield
            ON reshield.txid=spend.txid
           AND reshield.pool='ironwood'
           AND reshield.flow_type='shield'
          WHERE spend.prev_txid=sf.txid
        ) AS has_reshield,
        EXISTS (
          SELECT 1 FROM transaction_inputs spend WHERE spend.prev_txid=sf.txid
        ) AS has_spend
      FROM shielded_flows sf
      WHERE sf.pool='ironwood' AND sf.flow_type='deshield'
        AND DATE(TO_TIMESTAMP(sf.block_time)) = $1::date
    )
    SELECT
      COALESCE(SUM(amount_zat),0)::bigint AS deshielded_zat,
      COALESCE(SUM(CASE WHEN NOT has_public_destination THEN amount_zat ELSE 0 END),0)::bigint AS held_zat,
      COALESCE(SUM(CASE WHEN has_reshield THEN amount_zat ELSE 0 END),0)::bigint AS reshielded_zat,
      COALESCE(SUM(CASE WHEN has_spend AND NOT has_reshield THEN amount_zat ELSE 0 END),0)::bigint AS transferred_zat,
      COUNT(*)::int AS tx_count
    FROM deshields
  `, [date]);
  const row = aggregate.rows[0] || {};
  const source = await sourceForDate(client, date);
  await client.query('BEGIN');
  try {
    await client.query('DELETE FROM turnstile_daily WHERE date=$1 AND pool=$2', [date, 'ironwood']);
    await client.query(`
      INSERT INTO turnstile_daily
        (date,pool,deshielded_zat,held_zat,reshielded_zat,exchange_zat,
         bridge_zat,transferred_zat,tx_count,source_block_height,source_block_hash)
      VALUES ($1,'ironwood',$2,$3,$4,0,0,$5,$6,$7,$8)
    `, [
      date, String(row.deshielded_zat || 0), String(row.held_zat || 0),
      String(row.reshielded_zat || 0), String(row.transferred_zat || 0),
      Number(row.tx_count || 0), source.height, source.hash,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return Number(row.tx_count || 0);
}

async function run() {
  const client = await pool.connect();
  try {
    await withAdvisoryLock(client, LOCK_ID, async () => {
      const bookmark = await getBookmark(client);
      const dates = await datesToProcess(client, bookmark);
      let processed = 0;
      for (const date of dates) processed += await recomputeDate(client, date);
      const max = await client.query(`
        SELECT COALESCE(MAX(block_time),0) AS value
        FROM shielded_flows WHERE pool='ironwood' AND flow_type='deshield'
      `);
      const nextBookmark = Number(max.rows[0]?.value || 0);
      if (nextBookmark > bookmark) await setBookmark(client, nextBookmark);
      log(`W.cash turnstile processed ${dates.length} date(s), ${processed} deshield transaction(s)`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) run().catch((error) => {
  log(`ERROR: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { datesToProcess, recomputeDate, run };
