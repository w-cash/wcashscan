/**
 * W.cash mining endpoints.
 *
 * These routes intentionally expose only facts present in the W.cash
 * index: blocks, coinbase totals, Wolf difficulty/solution-rate estimates,
 * and optional operator-verified attribution. Unknown miners stay visible.
 */

const express = require('express');
const router = express.Router();
const {
  POOL_BY_ADDRESS,
  POOL_BY_TAG,
  getPoolTagSql,
  getPoolName,
  getPoolInfo,
} = require('../../lib/wcash-mining-attribution');
const { callWcashRPC } = require('../../lib/zebra-rpc');
const { logSafeError } = require('../lib/safe-log');

const CACHE_TTL = 300;

function getCache(req, key) {
  const redis = req.app.locals.redisClient;
  if (!redis?.isOpen) return Promise.resolve(null);
  return redis.get(key).then((value) => (value ? JSON.parse(value) : null)).catch(() => null);
}

function setCache(req, key, value, ttl = CACHE_TTL) {
  const redis = req.app.locals.redisClient;
  if (!redis?.isOpen) return Promise.resolve();
  return redis.setEx(key, ttl, JSON.stringify(value)).catch(() => undefined);
}

const PERIODS = {
  '24h': '24 hours',
  '3d': '3 days',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '6m': '180 days',
  '1y': '365 days',
};

function periodClause(period, column = 'timestamp') {
  if (period === 'all') return '';
  const interval = PERIODS[period] || PERIODS['7d'];
  return `${column} >= EXTRACT(EPOCH FROM NOW() - INTERVAL '${interval}')`;
}

function knownMiner(address, tag) {
  return getPoolInfo(address, tag) || null;
}

function displayMiner(address, tag) {
  return getPoolName(address, tag) || 'Unknown';
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapPoolRows(rows) {
  const result = new Map();
  for (const row of rows) {
    const name = displayMiner(row.miner_address, row.coinbase_hex);
    const info = knownMiner(row.miner_address, row.coinbase_hex);
    const existing = result.get(name) || {
      name,
      address: info ? row.miner_address : null,
      url: info?.url || null,
      region: info?.region || null,
      verified: info?.verified === true || info?.attribution === 'operator-config',
      blocks: 0,
      totalFeesZat: 0n,
    };
    existing.blocks += asNumber(row.block_count);
    existing.totalFeesZat += BigInt(row.total_fees_zat || 0);
    result.set(name, existing);
  }
  return [...result.values()];
}

router.get('/api/mining/pool-distribution', async (req, res) => {
  const period = String(req.query.period || '7d');
  const cacheKey = `wcash:mining:distribution:${period}`;
  try {
    const cached = await getCache(req, cacheKey);
    if (cached) return res.json(cached);

    const where = periodClause(period);
    const result = await req.app.locals.pool.query(`
      SELECT miner_address, coinbase_hex, COUNT(*) AS block_count,
             COALESCE(SUM(total_fees), 0) AS total_fees_zat
      FROM blocks
      ${where ? `WHERE ${where}` : ''}
      GROUP BY miner_address, coinbase_hex
      ORDER BY block_count DESC
    `);
    const totalBlocks = result.rows.reduce((sum, row) => sum + asNumber(row.block_count), 0);
    const pools = mapPoolRows(result.rows)
      .map((row) => ({ ...row, share: totalBlocks ? row.blocks / totalBlocks : 0, totalFeesZat: row.totalFeesZat.toString() }))
      .sort((a, b) => b.blocks - a.blocks);
    const response = {
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      period,
      totalBlocks,
      pools,
      attribution: Object.keys(POOL_BY_ADDRESS).length || Object.keys(POOL_BY_TAG).length ? 'operator-configured' : 'unknown-only',
      generatedAt: new Date().toISOString(),
    };
    await setCache(req, cacheKey, response);
    res.json(response);
  } catch (error) {
    logSafeError('W.cash mining distribution failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash mining distribution' });
  }
});

router.get('/api/mining/pool-ranking', async (req, res) => {
  const period = String(req.query.period || '7d');
  const cacheKey = `wcash:mining:ranking:${period}`;
  try {
    const cached = await getCache(req, cacheKey);
    if (cached) return res.json(cached);
    const where = periodClause(period);
    const result = await req.app.locals.pool.query(`
      SELECT miner_address, coinbase_hex, COUNT(*) AS block_count,
             COALESCE(SUM(total_fees), 0) AS total_fees_zat,
             MIN(timestamp) AS first_block_ts, MAX(timestamp) AS last_block_ts
      FROM blocks
      ${where ? `WHERE ${where}` : ''}
      GROUP BY miner_address, coinbase_hex
      ORDER BY block_count DESC
    `);
    const totalBlocks = result.rows.reduce((sum, row) => sum + asNumber(row.block_count), 0);
    const ranking = mapPoolRows(result.rows)
      .map((row, index) => {
        const source = result.rows.find((candidate) => displayMiner(candidate.miner_address, candidate.coinbase_hex) === row.name);
        const blocks = row.blocks;
        const first = asNumber(source?.first_block_ts);
        const last = asNumber(source?.last_block_ts);
        return {
          rank: index + 1,
          name: row.name,
          address: row.address,
          url: row.url,
          region: row.region,
          verified: row.verified,
          blocks,
          share: totalBlocks ? blocks / totalBlocks : 0,
          totalFeesZat: row.totalFeesZat.toString(),
          avgBlockInterval: blocks > 1 && last >= first ? (last - first) / (blocks - 1) : null,
        };
      });
    const response = { success: true, network: 'wcash', ticker: 'TWC', period, totalBlocks, ranking, generatedAt: new Date().toISOString() };
    await setCache(req, cacheKey, response);
    res.json(response);
  } catch (error) {
    logSafeError('W.cash mining ranking failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash mining ranking' });
  }
});

router.get('/api/mining/hashrate-share', async (req, res) => {
  const period = String(req.query.period || '30d');
  const cacheKey = `wcash:mining:share:${period}`;
  try {
    const cached = await getCache(req, cacheKey);
    if (cached) return res.json(cached);
    const where = periodClause(period);
    const result = await req.app.locals.pool.query(`
      SELECT date_trunc('day', to_timestamp(timestamp)) AS day,
             miner_address, coinbase_hex, COUNT(*) AS block_count
      FROM blocks
      ${where ? `WHERE ${where}` : ''}
      GROUP BY day, miner_address, coinbase_hex
      ORDER BY day ASC
    `);
    const days = new Map();
    for (const row of result.rows) {
      const date = new Date(row.day).toISOString().slice(0, 10);
      const values = days.get(date) || {};
      const name = displayMiner(row.miner_address, row.coinbase_hex);
      values[name] = (values[name] || 0) + asNumber(row.block_count);
      days.set(date, values);
    }
    const series = [...days.entries()].map(([date, values]) => {
      const totalBlocks = Object.values(values).reduce((sum, count) => sum + count, 0);
      const pools = Object.fromEntries(Object.entries(values).map(([name, count]) => [name, totalBlocks ? count / totalBlocks : 0]));
      return { date, totalBlocks, pools };
    });
    const response = { success: true, network: 'wcash', ticker: 'TWC', period, series, allPools: [...new Set(series.flatMap((point) => Object.keys(point.pools)))], generatedAt: new Date().toISOString() };
    await setCache(req, cacheKey, response, 600);
    res.json(response);
  } catch (error) {
    logSafeError('W.cash mining share failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash mining share' });
  }
});

router.get('/api/mining/rewards', async (req, res) => {
  const period = String(req.query.period || '7d');
  try {
    const where = periodClause(period, 'b.timestamp');
    const result = await req.app.locals.pool.query(`
      SELECT date_trunc('day', to_timestamp(b.timestamp)) AS day,
             COUNT(*) AS block_count,
             COALESCE(SUM(b.total_fees), 0) AS total_fees_zat,
             COALESCE(SUM(t.total_output), 0) AS total_coinbase_output_zat
      FROM blocks b
      JOIN transactions t ON t.block_height = b.height AND t.is_coinbase = true
      ${where ? `WHERE ${where}` : ''}
      GROUP BY day ORDER BY day ASC
    `);
    res.json({
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      unit: 'zatoshi in *Zat fields; TWC in display fields',
      period,
      series: result.rows.map((row) => ({
        date: new Date(row.day).toISOString().slice(0, 10),
        blocks: asNumber(row.block_count),
        totalFeesZat: String(row.total_fees_zat || 0),
        totalCoinbaseZat: String(row.total_coinbase_output_zat || 0),
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logSafeError('W.cash mining rewards failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash mining rewards' });
  }
});

router.get('/api/mining/miner-behavior', async (req, res) => {
  const period = String(req.query.period || '90d');
  try {
    const exists = await req.app.locals.pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mining_behavior_daily') AS exists
    `);
    if (!exists.rows[0]?.exists) {
      return res.json({ success: true, network: 'wcash', ticker: 'TWC', period, available: false, series: [], summary: null, message: 'W.cash miner movement history is not available yet.' });
    }
    const movementWhere = period === 'all'
      ? ''
      : `WHERE date >= CURRENT_DATE - INTERVAL '${PERIODS[period] || PERIODS['90d']}'`;
    const result = await req.app.locals.pool.query(`
      SELECT date, pool_name, earned_zat, spent_zat, held_zat, blocks_mined
      FROM mining_behavior_daily
      ${movementWhere}
      ORDER BY date ASC, pool_name ASC
    `);
    if (result.rows.length === 0) {
      return res.json({ success: true, network: 'wcash', ticker: 'TWC', period, available: false, series: [], summary: null, message: 'W.cash miner movement history is not available yet.' });
    }
    const byDate = new Map();
    for (const row of result.rows) {
      const date = new Date(row.date).toISOString().slice(0, 10);
      const item = byDate.get(date) || { date, earned: 0n, moved: 0n, held: 0n, pools: {} };
      item.earned += BigInt(row.earned_zat || 0);
      item.moved += BigInt(row.spent_zat || 0);
      item.held += BigInt(row.held_zat || 0);
      item.pools[row.pool_name] = { earnedZat: String(row.earned_zat || 0), movedZat: String(row.spent_zat || 0), heldZat: String(row.held_zat || 0), blocks: asNumber(row.blocks_mined) };
      byDate.set(date, item);
    }
    const series = [...byDate.values()].map((item) => ({ date: item.date, earnedZat: item.earned.toString(), movedZat: item.moved.toString(), heldZat: item.held.toString(), pools: item.pools }));
    const totalEarned = series.reduce((sum, item) => sum + BigInt(item.earnedZat), 0n);
    const totalMoved = series.reduce((sum, item) => sum + BigInt(item.movedZat), 0n);
    res.json({ success: true, network: 'wcash', ticker: 'TWC', period, available: true, series, summary: { totalEarnedZat: totalEarned.toString(), totalMovedZat: totalMoved.toString(), totalHeldZat: (totalEarned - totalMoved).toString() }, message: 'Movement means a mined output was later spent; it does not identify a sale or destination.' });
  } catch (error) {
    logSafeError('W.cash miner behavior failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash miner movement history' });
  }
});

// This endpoint is useful to the gallery and deliberately does not infer
// hardware from a foreign-chain difficulty formula. It asks Wolf for its own
// child-chain solution-rate estimate.
router.get('/api/mining/network-hashrate', async (req, res) => {
  try {
    const result = await callWcashRPC('getnetworksolps', [120]);
    res.json({ success: true, network: 'wcash', ticker: 'TWC', unit: 'Sol/s', solutionRate: result, source: 'wolf:getnetworksolps' });
  } catch (error) {
    logSafeError('W.cash solution rate failed:', error);
    res.status(503).json({ success: false, available: false, error: 'W.cash solution rate unavailable' });
  }
});

router.get('/api/mining/hashrate-history', async (req, res) => {
  try {
    const latest = Number((await req.app.locals.pool.query('SELECT MAX(height) AS height FROM blocks')).rows[0]?.height || 0);
    if (!latest) return res.json({ success: true, network: 'wcash', ticker: 'TWC', available: false, points: [] });
    const step = Math.max(1, Math.floor(24 * 60 * 60 / 75));
    const heights = [];
    for (let height = latest; height >= 0 && heights.length < 31; height -= step) heights.push(height);
    const points = [];
    for (const height of heights.reverse()) {
      try {
        const solutionRate = await callWcashRPC('getnetworksolps', [120, height]);
        const block = await req.app.locals.pool.query('SELECT timestamp FROM blocks WHERE height=$1', [height]);
        points.push({ height, date: block.rows[0]?.timestamp ? new Date(Number(block.rows[0].timestamp) * 1000).toISOString() : null, solutionRate: Number(solutionRate) || 0 });
      } catch {
        // A node may not expose historical solution-rate sampling. Leave the
        // point out rather than substituting a foreign difficulty formula.
      }
    }
    res.json({ success: true, network: 'wcash', ticker: 'TWC', available: points.length > 0, unit: 'Sol/s', source: 'wolf:getnetworksolps', points });
  } catch (error) {
    logSafeError('W.cash solution-rate history failed:', error);
    res.status(503).json({ success: false, available: false, error: 'W.cash solution-rate history unavailable' });
  }
});

module.exports = router;
