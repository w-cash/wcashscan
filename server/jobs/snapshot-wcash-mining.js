#!/usr/bin/env node

/** Compute only public W.cash coinbase movement facts. */

const { getPool, getReadPool } = require('../lib/db-pool');
const { getPoolName } = require('../lib/wcash-mining-attribution');
const { log, loadEnv, withAdvisoryLock } = require('../lib/job-utils');

loadEnv(__dirname);
const pool = getPool({ max: 2 });
const readPool = getReadPool({ max: 2 });
const LOCK_ID = 8_392_712;

function minerName(address, coinbaseHex) {
  return getPoolName(address, coinbaseHex) || 'Unknown';
}

async function computeDay(client, date) {
  const start = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const end = start + 86400;
  const result = await readPool.query(`
    WITH coinbase AS MATERIALIZED (
      SELECT b.miner_address, b.coinbase_hex, t.txid
      FROM blocks b JOIN transactions t ON t.block_height=b.height AND t.is_coinbase=true
      WHERE b.timestamp >= $1 AND b.timestamp < $2
    ), outputs AS MATERIALIZED (
      SELECT c.miner_address, c.coinbase_hex, o.txid, o.vout_index, o.value
      FROM coinbase c JOIN transaction_outputs o ON o.txid=c.txid
      WHERE o.address IS NOT NULL AND o.address=c.miner_address
    )
    SELECT o.miner_address, o.coinbase_hex, COUNT(*) AS output_count,
           COALESCE(SUM(o.value),0) AS earned_zat,
           COALESCE(SUM(CASE WHEN i.txid IS NOT NULL THEN o.value ELSE 0 END),0) AS moved_zat,
           COUNT(i.txid) AS outputs_moved
    FROM outputs o
    LEFT JOIN transaction_inputs i ON i.prev_txid=o.txid AND i.prev_vout=o.vout_index
    GROUP BY o.miner_address, o.coinbase_hex
  `, [start, end]);
  const blocks = await readPool.query(`
    SELECT miner_address, coinbase_hex, COUNT(*) AS blocks
    FROM blocks WHERE timestamp >= $1 AND timestamp < $2
    GROUP BY miner_address, coinbase_hex
  `, [start, end]);
  const blockMap = new Map(blocks.rows.map((row) => [`${row.miner_address || ''}:${row.coinbase_hex || ''}`, Number(row.blocks)]));

  await client.query('DELETE FROM mining_behavior_daily WHERE date=$1', [date]);
  for (const row of result.rows) {
    const earned = BigInt(row.earned_zat || 0);
    const moved = BigInt(row.moved_zat || 0);
    await client.query(`
      INSERT INTO mining_behavior_daily
        (date,pool_name,miner_address,earned_zat,spent_zat,held_zat,blocks_mined,outputs_spent,outputs_total)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      date,
      minerName(row.miner_address, row.coinbase_hex),
      row.miner_address || 'unknown',
      earned.toString(), moved.toString(), (earned - moved).toString(),
      blockMap.get(`${row.miner_address || ''}:${row.coinbase_hex || ''}`) || 0,
      Number(row.outputs_moved || 0), Number(row.output_count || 0),
    ]);
  }
}

async function run() {
  const client = await pool.connect();
  try {
    await withAdvisoryLock(client, LOCK_ID, async () => {
      const days = Number(process.env.WCASH_MINING_DAYS || 7);
      const today = new Date();
      for (let i = days; i >= 1; i -= 1) {
        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() - i);
        await computeDay(client, date.toISOString().slice(0, 10));
      }
      log(`W.cash mining movement snapshot processed ${Math.max(days, 0)} day(s)`);
    });
  } finally {
    client.release();
    await Promise.all([pool.end(), readPool.end()]);
  }
}

if (require.main === module) run().catch((error) => { log(`ERROR: ${error.message}`); process.exitCode = 1; });

module.exports = { run };
