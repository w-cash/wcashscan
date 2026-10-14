'use strict';

/** W.cash-only statistical activity feed. */

const express = require('express');
const router = express.Router();
const { logSafeError } = require('../lib/safe-log');

function days(value) {
  const parsed = Number(value || 30);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 365) : 30;
}

router.get('/api/pulse', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const period = days(req.query.days);
    const result = await req.app.locals.pool.query(`
      SELECT date, metric, value, zscore, mean, std, direction, description, detail, created_at
      FROM metric_anomalies
      WHERE date >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
      ORDER BY date DESC, ABS(zscore) DESC
      LIMIT $2
    `, [period, limit]);
    res.json({
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      available: true,
      periodDays: period,
      anomalies: result.rows.map((row) => ({
        date: row.date,
        metric: row.metric,
        value: Number(row.value),
        zscore: Number(row.zscore),
        mean: Number(row.mean),
        std: Number(row.std),
        direction: row.direction,
        description: row.description,
        detail: row.detail,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    logSafeError('W.cash pulse query failed:', error);
    res.status(503).json({ success: false, available: false, error: 'W.cash activity pulse is not available yet' });
  }
});

router.get('/api/pulse/summary', async (req, res) => {
  try {
    const period = days(req.query.days);
    const result = await req.app.locals.pool.query(`
      SELECT direction, COUNT(*)::int AS count
      FROM metric_anomalies
      WHERE date >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
      GROUP BY direction
    `, [period]);
    const summary = { up: 0, down: 0 };
    for (const row of result.rows) summary[row.direction] = Number(row.count) || 0;
    res.json({ success: true, network: 'wcash', ticker: 'TWC', periodDays: period, ...summary, total: summary.up + summary.down });
  } catch (error) {
    logSafeError('W.cash pulse summary failed:', error);
    res.status(503).json({ success: false, available: false, error: 'W.cash activity pulse is not available yet' });
  }
});

module.exports = router;
