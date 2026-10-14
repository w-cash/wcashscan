/**
 * W.cash activity aggregates.
 *
 * The scheduler in server/jobs/update-wcash-stats.js writes the current
 * snapshot. This route only reads PostgreSQL; it never calls a foreign chain,
 * price service, or legacy privacy scorer.
 */

const express = require('express');
const router = express.Router();
const { logSafeError } = require('../lib/safe-log');

const ZAT_PER_TWC = 100_000_000;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toTwc(value) {
  return toNumber(value) / ZAT_PER_TWC;
}

function parseDate(value, label) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${label} date; use ISO format YYYY-MM-DD`);
  return date;
}

router.use((req, _res, next) => {
  req.wcashPool = req.app.locals.pool;
  next();
});

router.get('/api/privacy-stats', async (req, res) => {
  try {
    const statsResult = await req.wcashPool.query(`
      SELECT
        total_blocks, total_transactions, shielded_tx, transparent_tx,
        coinbase_tx, mixed_tx, fully_shielded_tx, shielded_pool_size,
        shielded_percentage, privacy_score, privacy_score_breakdown,
        avg_shielded_per_day, adoption_trend, last_block_scanned,
        transparent_pool_size, chain_supply, ironwood_pool_size, updated_at
      FROM privacy_stats
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    if (!statsResult.rows[0]) {
      return res.status(503).json({
        success: false,
        available: false,
        network: 'wcash',
        ticker: 'TWC',
        error: 'W.cash activity stats are not indexed yet',
      });
    }

    const stats = statsResult.rows[0];
    const trendDays = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 30, 7), 1000);
    const trendsResult = await req.wcashPool.query(`
      SELECT date, shielded_count, transparent_count, shielded_percentage,
             pool_size, privacy_score, ironwood_pool_size,
             transparent_pool_size, chain_supply
      FROM privacy_trends_daily
      ORDER BY date DESC
      LIMIT $1
    `, [trendDays]);

    const daily = trendsResult.rows.reverse().map((row) => ({
      date: row.date,
      // Keep the established response keys for existing dashboard clients;
      // these counts now mean Ironwood versus transparent activity.
      shielded: toNumber(row.shielded_count),
      ironwood: toNumber(row.shielded_count),
      transparent: toNumber(row.transparent_count),
      shieldedPercentage: toNumber(row.shielded_percentage),
      poolSize: toTwc(row.pool_size),
      ironwoodPool: toTwc(row.ironwood_pool_size ?? row.pool_size),
      transparentPool: toTwc(row.transparent_pool_size),
      chainSupply: toTwc(row.chain_supply),
      privacyScore: toNumber(row.privacy_score),
    }));

    const ironwood = toTwc(stats.ironwood_pool_size ?? stats.shielded_pool_size);
    const transparent = toTwc(stats.transparent_pool_size);
    const chainSupply = toTwc(stats.chain_supply);
    const response = {
      success: true,
      available: true,
      network: 'wcash',
      ticker: 'TWC',
      units: { display: 'TWC', base: 'zatoshi', zatoshiPerTwc: ZAT_PER_TWC },
      totals: {
        blocks: toNumber(stats.total_blocks),
        totalTx: toNumber(stats.total_transactions),
        ironwoodTx: toNumber(stats.shielded_tx),
        // Compatibility name retained for the existing Wcash UI.
        shieldedTx: toNumber(stats.shielded_tx),
        transparentTx: toNumber(stats.transparent_tx),
        coinbaseTx: toNumber(stats.coinbase_tx),
        mixedTx: toNumber(stats.mixed_tx),
        fullyShieldedTx: toNumber(stats.fully_shielded_tx),
      },
      ironwoodPool: { currentSize: ironwood, ironwood, transparent, chainSupply },
      // Compatibility object retained while dashboard clients migrate to the
      // explicit ironwoodPool name.
      shieldedPool: { currentSize: ironwood, ironwood, transparent, chainSupply },
      metrics: {
        ironwoodPercentage: toNumber(stats.shielded_percentage),
        shieldedPercentage: toNumber(stats.shielded_percentage),
        privacyScore: toNumber(stats.privacy_score),
        activityIndex: toNumber(stats.privacy_score),
        scoreBreakdown: stats.privacy_score_breakdown || null,
        avgShieldedPerDay: toNumber(stats.avg_shielded_per_day),
        avgIronwoodPerDay: toNumber(stats.avg_shielded_per_day),
        adoptionTrend: stats.adoption_trend || 'stable',
      },
      trends: { daily },
      lastUpdated: stats.updated_at ? new Date(stats.updated_at).toISOString() : null,
      lastBlockScanned: toNumber(stats.last_block_scanned),
      note: 'Activity share is a public transaction-count metric, not a measure of private ownership or recipient identity.',
    };
    return res.json(response);
  } catch (error) {
    logSafeError('W.cash activity stats failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch W.cash activity stats' });
  }
});

router.get('/api/stats/shielded-count', async (req, res) => {
  try {
    const since = parseDate(req.query.since, 'since');
    const sinceSeconds = Math.floor(since.getTime() / 1000);
    const result = await req.wcashPool.query(`
      SELECT COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE vin_count > 0 OR vout_count > 0)::bigint AS mixed,
             COUNT(*) FILTER (WHERE vin_count = 0 AND vout_count = 0)::bigint AS fully_private
      FROM transactions
      WHERE has_ironwood = true AND NOT is_coinbase AND block_time >= $1
    `, [sinceSeconds]);
    const row = result.rows[0] || {};
    const totalIronwood = toNumber(row.total);
    return res.json({
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      since: String(req.query.since),
      totalIronwood,
      totalShielded: totalIronwood,
      mixed: toNumber(row.mixed),
      fullyPrivate: toNumber(row.fully_private),
      note: 'Ironwood transaction count; no private recipient inference.',
    });
  } catch (error) {
    logSafeError('W.cash Ironwood count failed:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to fetch W.cash Ironwood count' });
  }
});

router.get('/api/stats/shielded-daily', async (req, res) => {
  try {
    const since = parseDate(req.query.since, 'since');
    const until = req.query.until ? parseDate(req.query.until, 'until') : new Date();
    const sinceSeconds = Math.floor(since.getTime() / 1000);
    const untilSeconds = Math.floor(until.getTime() / 1000);
    const result = await req.wcashPool.query(`
      SELECT DATE(TO_TIMESTAMP(block_time)) AS date,
             COUNT(*)::bigint AS count
      FROM transactions
      WHERE has_ironwood = true AND NOT is_coinbase
        AND block_time >= $1 AND block_time < $2
      GROUP BY DATE(TO_TIMESTAMP(block_time))
      ORDER BY date ASC
    `, [sinceSeconds, untilSeconds]);
    const daily = result.rows.map((row) => ({ date: row.date, count: toNumber(row.count) }));
    return res.json({
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      since: String(req.query.since),
      until: until.toISOString().slice(0, 10),
      totalDays: daily.length,
      totalIronwood: daily.reduce((sum, row) => sum + row.count, 0),
      totalShielded: daily.reduce((sum, row) => sum + row.count, 0),
      daily,
    });
  } catch (error) {
    logSafeError('W.cash daily Ironwood stats failed:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to fetch W.cash daily activity' });
  }
});

module.exports = router;
