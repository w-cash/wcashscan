'use strict';

/**
 * W.cash value-pool analytics.
 *
 * The indexer writes the public Ironwood and transparent snapshots. This
 * route never queries or invents foreign-chain pools, bridge classifications,
 * market prices, or migration tables.
 */

const express = require('express');
const { logSafeError } = require('../lib/safe-log');
const { getWcashProfile } = require('../lib/wcash-profile');

const router = express.Router();
let pool;
let redisClient;

router.use((req, res, next) => {
  pool = req.app.locals.pool;
  redisClient = req.app.locals.redisClient;
  next();
});

async function cached(key, ttl, load) {
  try {
    if (redisClient?.isOpen) {
      const hit = await redisClient.get(key);
      if (hit) return JSON.parse(hit);
    }
  } catch {}

  const value = await load();
  try {
    if (redisClient?.isOpen) await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch {}
  return value;
}

function periodToSeconds(period) {
  if (period === 'all') return null;
  return ({ '7d': 604800, '30d': 2592000, '90d': 7776000, '1y': 31536000 })[period] || 2592000;
}

function toTwc(value) {
  return Number(value || 0) / 100_000_000;
}

function computeDelta(currentZat, previousZat) {
  if (previousZat == null || currentZat == null) return null;
  return Number(currentZat) - Number(previousZat);
}

router.get('/api/pools/overview', async (req, res) => {
  try {
    const profile = getWcashProfile();
    const data = await cached(`wcash:${profile.id}:pools:overview`, 300, async () => {
      const currentResult = await pool.query(`
        SELECT COALESCE(ironwood_pool_size, 0) AS ironwood_pool_size,
               COALESCE(transparent_pool_size, 0) AS transparent_pool_size,
               COALESCE(chain_supply, 0) AS chain_supply,
               updated_at
        FROM privacy_stats
        ORDER BY updated_at DESC
        LIMIT 1
      `);
      if (!currentResult.rows.length) return null;

      const current = currentResult.rows[0];
      const historyResult = await pool.query(`
        SELECT date, ironwood_pool_size, transparent_pool_size,
               chain_supply, pool_size
        FROM privacy_trends_daily
        WHERE date IN (CURRENT_DATE - 1, CURRENT_DATE - 7, CURRENT_DATE - 30)
        ORDER BY date DESC
      `);

      const snapshots = {};
      for (const row of historyResult.rows) {
        const daysAgo = Math.round((Date.now() - new Date(row.date).getTime()) / 86_400_000);
        const key = daysAgo <= 2 ? '24h' : daysAgo <= 8 ? '7d' : '30d';
        snapshots[key] = row;
      }

      const ironwood = Number(current.ironwood_pool_size) || 0;
      const transparent = Number(current.transparent_pool_size) || 0;
      const chainSupply = Number(current.chain_supply) || 0;

      return {
        current: {
          ironwood,
          transparent,
          shielded: ironwood,
          chainSupply,
          updatedAt: current.updated_at,
        },
        deltas: {
          ironwood: Object.fromEntries(Object.entries(snapshots).map(([period, row]) => [period, computeDelta(ironwood, row?.ironwood_pool_size)])),
          transparent: Object.fromEntries(Object.entries(snapshots).map(([period, row]) => [period, computeDelta(transparent, row?.transparent_pool_size)])),
          shielded: Object.fromEntries(Object.entries(snapshots).map(([period, row]) => [period, computeDelta(ironwood, row?.ironwood_pool_size)])),
        },
      };
    });

    if (!data) return res.status(503).json({ success: false, error: 'W.cash value-pool data is not available yet' });
    return res.json({ success: true, network: profile.id, ticker: profile.ticker, ...data });
  } catch (error) {
    logSafeError('W.cash pools/overview error:', error);
    return res.status(503).json({ success: false, error: 'W.cash value-pool data is not available' });
  }
});

router.get('/api/pools/flows', async (req, res) => {
  try {
    const profile = getWcashProfile();
    const period = typeof req.query.period === 'string' ? req.query.period : '30d';
    const poolFilter = typeof req.query.pool === 'string' ? req.query.pool : 'all';
    const granularity = req.query.granularity === 'hourly' ? 'hourly' : 'daily';
    const format = req.query.format === 'zatoshi' ? 'zatoshi' : 'twc';
    if (!['all', 'ironwood'].includes(poolFilter)) {
      return res.status(400).json({ success: false, error: 'W.cash supports only the Ironwood value pool' });
    }

    const useZatoshi = format === 'zatoshi';
    const cacheKey = `wcash:${profile.id}:pools:flows:${period}:${poolFilter}:${granularity}:${format}`;
    const data = await cached(cacheKey, granularity === 'hourly' ? 120 : 300, async () => {
      const periodSeconds = periodToSeconds(period);
      const since = periodSeconds == null ? null : Math.floor(Date.now() / 1000) - periodSeconds;

      let result;
      if (granularity === 'hourly') {
        const params = [];
        const clauses = [];
        if (since != null) {
          params.push(since);
          clauses.push(`block_time >= $${params.length}`);
        }
        if (poolFilter === 'ironwood') {
          params.push(poolFilter);
          clauses.push(`pool = $${params.length}`);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        result = await pool.query(`
          SELECT DATE_TRUNC('hour', TO_TIMESTAMP(block_time)) AS bucket,
                 flow_type, SUM(amount_zat) AS total_zat, COUNT(*) AS tx_count
          FROM shielded_flows
          ${where}
          GROUP BY bucket, flow_type
          ORDER BY bucket
        `, params);
      } else {
        const params = [];
        const clauses = [];
        if (since != null) {
          params.push(new Date(since * 1000).toISOString().slice(0, 10));
          clauses.push(`date >= $${params.length}::date`);
        }
        if (poolFilter === 'ironwood') {
          params.push(poolFilter);
          clauses.push(`pool = $${params.length}`);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        try {
          result = await pool.query(`
            SELECT date, flow_type, total_zat, tx_count
            FROM flow_daily
            ${where}
            ORDER BY date
          `, params);
        } catch {
          const fallbackParams = [];
          const fallbackClauses = [];
          if (since != null) {
            fallbackParams.push(since);
            fallbackClauses.push(`block_time >= $${fallbackParams.length}`);
          }
          if (poolFilter === 'ironwood') {
            fallbackParams.push(poolFilter);
            fallbackClauses.push(`pool = $${fallbackParams.length}`);
          }
          const fallbackWhere = fallbackClauses.length ? `WHERE ${fallbackClauses.join(' AND ')}` : '';
          result = await pool.query(`
            SELECT DATE(TO_TIMESTAMP(block_time)) AS date,
                   flow_type, SUM(amount_zat) AS total_zat, COUNT(*) AS tx_count
            FROM shielded_flows
            ${fallbackWhere}
            GROUP BY date, flow_type
            ORDER BY date
          `, fallbackParams);
        }
      }

      const byBucket = {};
      for (const row of result.rows) {
        const date = granularity === 'hourly'
          ? new Date(row.bucket).toISOString()
          : new Date(row.date).toISOString().slice(0, 10);
        const entry = byBucket[date] ||= {
          date,
          shield: useZatoshi ? '0' : 0,
          deshield: useZatoshi ? '0' : 0,
          shieldTx: 0,
          deshieldTx: 0,
        };
        const amount = useZatoshi ? BigInt(row.total_zat || 0) : toTwc(row.total_zat);
        const isShield = row.flow_type === 'shield';
        const field = isShield ? 'shield' : 'deshield';
        entry[field] = useZatoshi
          ? (BigInt(entry[field]) + amount).toString()
          : entry[field] + amount;
        entry[isShield ? 'shieldTx' : 'deshieldTx'] += Number(row.tx_count) || 0;
      }

      const points = Object.values(byBucket).sort((a, b) => a.date.localeCompare(b.date));
      for (const point of points) {
        point.net = useZatoshi
          ? (BigInt(point.shield) - BigInt(point.deshield)).toString()
          : point.shield - point.deshield;
      }
      return { period, pool: poolFilter, granularity, format, points };
    });

    return res.json({ success: true, network: profile.id, ticker: profile.ticker, ...data });
  } catch (error) {
    logSafeError('W.cash pools/flows error:', error);
    return res.status(503).json({ success: false, error: 'W.cash flow data is not available' });
  }
});

// W.cash has no exchange/bridge oracle. This compatibility endpoint reports
// only observed Ironwood shield/deshield flow totals and labels everything
// else as unclassified; it never guesses where a private value went.
router.get('/api/pools/turnstile', async (req, res) => {
  try {
    const profile = getWcashProfile();
    const since = typeof req.query.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.since)
      ? req.query.since
      : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const result = await pool.query(`
      SELECT DATE(TO_TIMESTAMP(block_time)) AS date, flow_type,
             COALESCE(SUM(amount_zat), 0)::bigint AS amount_zat,
             COUNT(*)::int AS tx_count
      FROM shielded_flows
      WHERE pool = 'ironwood' AND block_time >= EXTRACT(EPOCH FROM $1::date)
      GROUP BY date, flow_type ORDER BY date
    `, [since]);
    const byDate = new Map();
    for (const row of result.rows) {
      const date = new Date(row.date).toISOString().slice(0, 10);
      const item = byDate.get(date) || { date, shieldedZat: '0', deshieldedZat: '0', txCount: 0 };
      if (row.flow_type === 'shield') item.shieldedZat = (BigInt(item.shieldedZat) + BigInt(row.amount_zat || 0)).toString();
      if (row.flow_type === 'deshield') item.deshieldedZat = (BigInt(item.deshieldedZat) + BigInt(row.amount_zat || 0)).toString();
      item.txCount += Number(row.tx_count) || 0;
      byDate.set(date, item);
    }
    res.json({
      success: true,
      network: profile.id,
      ticker: profile.ticker,
      available: true,
      classification: 'unclassified',
      notice: 'W.cash chain data cannot identify exchanges, bridges, or private recipients.',
      timeseries: [...byDate.values()],
      since,
    });
  } catch (error) {
    logSafeError('W.cash flow observation failed:', error);
    res.status(503).json({ success: false, available: false, error: 'W.cash flow data is not available' });
  }
});

module.exports = router;
