#!/usr/bin/env node

/** W.cash-only activity anomaly job. */

const { getPool, getReadPool } = require('../lib/db-pool');
const { log, loadEnv, withAdvisoryLock } = require('../lib/job-utils');

loadEnv(__dirname);
const pool = getPool({ max: 2 });
const readPool = getReadPool({ max: 2 });
const LOCK_ID = 8_392_713;
const LOOKBACK_DAYS = 90;

const METRICS = {
  tx_count_total: {
    unit: 'transactions',
    query: `SELECT date, (shielded_count + transparent_count)::numeric AS value FROM privacy_trends_daily WHERE date BETWEEN $1 AND $2 ORDER BY date`,
    up: 'Unusually high W.cash transaction activity',
    down: 'Unusually low W.cash transaction activity',
  },
  ironwood_tx_count: {
    unit: 'transactions',
    query: `SELECT date, shielded_count::numeric AS value FROM privacy_trends_daily WHERE date BETWEEN $1 AND $2 ORDER BY date`,
    up: 'Ironwood activity spike',
    down: 'Ironwood activity decline',
  },
  ironwood_share: {
    unit: '%',
    query: `SELECT date, shielded_percentage::numeric AS value FROM privacy_trends_daily WHERE date BETWEEN $1 AND $2 ORDER BY date`,
    up: 'Ironwood activity share increased',
    down: 'Ironwood activity share decreased',
  },
  shield_volume_twc: {
    unit: 'TWC',
    query: `SELECT DATE(TO_TIMESTAMP(block_time)) AS date, COALESCE(SUM(amount_zat),0)::numeric / 100000000 AS value FROM shielded_flows WHERE pool='ironwood' AND flow_type='shield' AND DATE(TO_TIMESTAMP(block_time)) BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`,
    up: 'Ironwood shielding volume spike',
    down: 'Ironwood shielding volume decline',
  },
  deshield_volume_twc: {
    unit: 'TWC',
    query: `SELECT DATE(TO_TIMESTAMP(block_time)) AS date, COALESCE(SUM(amount_zat),0)::numeric / 100000000 AS value FROM shielded_flows WHERE pool='ironwood' AND flow_type='deshield' AND DATE(TO_TIMESTAMP(block_time)) BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`,
    up: 'Ironwood deshielding volume spike',
    down: 'Ironwood deshielding volume decline',
  },
  daily_fees_twc: {
    unit: 'TWC',
    query: `SELECT DATE(TO_TIMESTAMP(timestamp)) AS date, COALESCE(SUM(total_fees),0)::numeric / 100000000 AS value FROM blocks WHERE DATE(TO_TIMESTAMP(timestamp)) BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`,
    up: 'W.cash fee activity spike',
    down: 'W.cash fee activity decline',
  },
};

function zscore(values) {
  if (values.length < 14) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  const std = Math.sqrt(variance);
  if (!std) return null;
  const value = values[values.length - 1];
  return { value, mean, std, score: (value - mean) / std };
}

async function run() {
  const client = await pool.connect();
  try {
    await withAdvisoryLock(client, LOCK_ID, async () => {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
      let inserted = 0;
      for (const [metric, definition] of Object.entries(METRICS)) {
        let rows;
        try { rows = (await readPool.query(definition.query, [start, end])).rows; } catch (error) { log(`Skipping ${metric}: ${error.message}`); continue; }
        const result = zscore(rows.map((row) => Number(row.value)));
        if (!result || Math.abs(result.score) < 2.5) continue;
        const direction = result.score > 0 ? 'up' : 'down';
        const format = (value) => definition.unit === '%' ? `${value.toFixed(1)}%` : `${value.toFixed(2)} ${definition.unit}`;
        await client.query(`
          INSERT INTO metric_anomalies (date,metric,value,zscore,mean,std,direction,description,detail)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (date,metric) DO UPDATE SET value=EXCLUDED.value,zscore=EXCLUDED.zscore,mean=EXCLUDED.mean,std=EXCLUDED.std,direction=EXCLUDED.direction,description=EXCLUDED.description,detail=EXCLUDED.detail,created_at=NOW()
        `, [end, metric, result.value, result.score, result.mean, result.std, direction, definition[direction], `${format(result.value)} (z=${result.score.toFixed(2)}, mean=${format(result.mean)})`]);
        inserted += 1;
      }
      log(`W.cash anomaly job wrote ${inserted} event(s)`);
    });
  } finally {
    client.release();
    await Promise.all([pool.end(), readPool.end()]);
  }
}

if (require.main === module) run().catch((error) => { log(`ERROR: ${error.message}`); process.exitCode = 1; });

module.exports = { zscore, run };
