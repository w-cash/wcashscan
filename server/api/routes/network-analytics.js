const { logSafeError } = require('../lib/safe-log');
/**
 * W.cash analytics routes — halving, mining history, pool trends, emission,
 * and serialized chain size. Every amount returned by this module is TWC
 * unless its field name ends in `Zat`/`Zatoshi`.
 */

const MAX_SUPPLY_TWC = 21_000_000;
const HALVING_CACHE_KEY = 'wcash:halving_info';
const HALVING_CACHE_TTL = 86400; // 24h

function wcashIdentity() {
  return {
    network: 'wcash',
    ticker: 'TWC',
    dataNetwork: process.env.WCASH_CHAIN || 'wcash-testnet-v5',
  };
}

async function getFromRedisCache(redisClient, key) {
  try {
    if (!redisClient?.isOpen) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function setRedisCache(redisClient, key, data, ttlSeconds) {
  try {
    if (!redisClient?.isOpen) return false;
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function periodToInterval(period) {
  if (period === 'all') return null;
  const map = {
    '7d': '7 days',
    '30d': '30 days',
    '90d': '90 days',
    '1y': '365 days',
  };
  return map[period] || '90 days';
}

/** True when W.cash pool columns have canonical, provenance-bearing history. */
async function hasVerifiedPerPoolBreakdown(pool) {
  try {
    const result = await pool.query(`
      SELECT source_block_height, source_block_hash, ironwood_pool_size,
             transparent_pool_size, pool_size, chain_supply
      FROM privacy_trends_daily
      WHERE source_block_height IS NOT NULL
        AND source_block_hash IS NOT NULL
        AND date >= CURRENT_DATE - INTERVAL '365 days'
      ORDER BY date DESC
    `);
    if (result.rows.length === 0) return false;

    return result.rows.every((row) => {
      try {
        const ironwood = BigInt(String(row.ironwood_pool_size ?? 0));
        const transparent = BigInt(String(row.transparent_pool_size ?? 0));
        const totalPool = BigInt(String(row.pool_size ?? 0));
        const supply = BigInt(String(row.chain_supply ?? 0));
        return ironwood >= 0n
          && transparent >= 0n
          && totalPool === ironwood
          && supply >= ironwood + transparent;
      } catch {
        return false;
      }
    });
  } catch {
    // A pre-migration database is not a verified W.cash pool history. Keep
    // the endpoint usable while clearly reporting the breakdown as unverified.
    return false;
  }
}

/** Shielded supply % = Ironwood / total chain supply. Never use tx-adoption %. */
function computeShieldedSupplyPct({ shieldedZat, chainSupplyZat, transparentZat }) {
  if (chainSupplyZat > 0) {
    return (shieldedZat / chainSupplyZat) * 100;
  }
  const poolTotalZat = shieldedZat + transparentZat;
  if (poolTotalZat > 0) {
    return (shieldedZat / poolTotalZat) * 100;
  }
  // pool_size is tracked but chain_supply not backfilled — omit (do not guess from shielded pool)
  return null;
}

function rollingAverage(values, window) {
  if (values.length === 0) return [];
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    out.push(avg);
  }
  return out;
}

async function discoverNextHalving(callZebraRPC, currentHeight) {
  const current = await callZebraRPC('getblocksubsidy', [currentHeight]);
  const currentTotal = current?.totalblocksubsidy;
  if (!currentTotal) throw new Error('Could not read current block subsidy');

  const coarseStep = 50000;
  const maxScan = 2_000_000;
  let coarseHit = null;

  for (let h = currentHeight + coarseStep; h <= currentHeight + maxScan; h += coarseStep) {
    const sub = await callZebraRPC('getblocksubsidy', [h]);
    if (sub?.totalblocksubsidy != null && sub.totalblocksubsidy < currentTotal) {
      coarseHit = h;
      break;
    }
  }

  if (!coarseHit) {
    throw new Error(`No subsidy reduction found within ${maxScan.toLocaleString()} blocks`);
  }

  let lo = Math.max(currentHeight + 1, coarseHit - coarseStep);
  let hi = coarseHit;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const sub = await callZebraRPC('getblocksubsidy', [mid]);
    if (sub?.totalblocksubsidy < currentTotal) hi = mid;
    else lo = mid + 1;
  }

  const nextSubsidy = await callZebraRPC('getblocksubsidy', [lo]);
  // Find the prior subsidy transition, then binary-search its exact height.
  let sameSubsidyHeight = currentHeight;
  let priorEraHeight = null;
  while (sameSubsidyHeight > 0) {
    const probeHeight = Math.max(0, sameSubsidyHeight - coarseStep);
    const subsidy = await callZebraRPC('getblocksubsidy', [probeHeight]);
    if (subsidy?.totalblocksubsidy !== currentTotal) {
      priorEraHeight = probeHeight;
      break;
    }
    if (probeHeight === 0) break;
    sameSubsidyHeight = probeHeight;
  }

  let eraStart = 1;
  if (priorEraHeight != null) {
    let startLo = priorEraHeight + 1;
    let startHi = sameSubsidyHeight;
    while (startLo < startHi) {
      const mid = Math.floor((startLo + startHi) / 2);
      const subsidy = await callZebraRPC('getblocksubsidy', [mid]);
      if (subsidy?.totalblocksubsidy === currentTotal) startHi = mid;
      else startLo = mid + 1;
    }
    eraStart = startLo;
  }
  const eraLength = lo - eraStart;
  const progress = eraLength > 0 ? ((currentHeight - eraStart) / eraLength) * 100 : 0;

  return {
    halvingBlock: lo,
    blocksRemaining: lo - currentHeight,
    eraStartBlock: eraStart,
    eraProgress: Math.min(Math.max(progress, 0), 100),
    currentSubsidy: currentTotal,
    nextSubsidy: nextSubsidy?.totalblocksubsidy ?? null,
    minerReward: current.miner ?? currentTotal,
    nextMinerReward: nextSubsidy?.miner ?? null,
  };
}

async function tableExists(pool, tableName) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return r.rows.length > 0;
}

async function columnExists(pool, tableName, columnName) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  );
  return r.rows.length > 0;
}

function registerNetworkAnalyticsRoutes(router) {
  router.get('/api/network/halving', async (req, res) => {
    try {
      const callZebraRPC = req.app.locals.callZebraRPC;
      const redisClient = req.app.locals.redisClient;
      const cached = await getFromRedisCache(redisClient, HALVING_CACHE_KEY);
      if (cached && cached.halvingBlock != null) {
        return res.json({ success: true, ...wcashIdentity(), ...cached, cached: true });
      }

      // Use Wolf for both height and subsidy so backfills cannot mix a stale
      // database height with live-chain subsidy values.
      const currentHeight = Number(await callZebraRPC('getblockcount'));
      if (!Number.isSafeInteger(currentHeight) || currentHeight < 1) {
        throw new Error('Could not read current Wolf height');
      }
      const halving = await discoverNextHalving(callZebraRPC, currentHeight);

      const avgBlockTime = 75;
      const estimatedSeconds = halving.blocksRemaining != null ? halving.blocksRemaining * avgBlockTime : null;
      const payload = {
        ...halving,
        currentHeight,
        estimatedSeconds,
        estimatedDate: estimatedSeconds
          ? new Date(Date.now() + estimatedSeconds * 1000).toISOString()
          : null,
      };

      // Only cache if we have real halving data (avoid persisting broken null state)
      if (setRedisCache && payload.halvingBlock != null) {
        await setRedisCache(redisClient, HALVING_CACHE_KEY, payload, HALVING_CACHE_TTL);
      }
      res.json({ success: true, ...wcashIdentity(), ...payload, cached: false });
    } catch (error) {
      logSafeError('❌ [HALVING] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch halving info' });
    }
  });

  router.get('/api/network/mining-metrics', async (req, res) => {
    try {
      const pool = req.app.locals.pool;
      const callZebraRPC = req.app.locals.callZebraRPC;
      const window = Math.min(Math.max(parseInt(req.query.window, 10) || 20, 5), 100);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 120, 20), 500);

      const result = await pool.query(
        `SELECT height, difficulty, timestamp, transaction_count, total_fees
         FROM blocks
         ORDER BY height DESC
         LIMIT $1`,
        [limit]
      );

      const rows = result.rows.reverse();
      const intervals = rows.map((r, i) => {
        if (i === 0) return 75;
        const prev = rows[i - 1];
        const delta = parseInt(r.timestamp, 10) - parseInt(prev.timestamp, 10);
        return delta > 0 && delta < 600 ? delta : 75;
      });

      const difficulties = rows.map((r) => parseFloat(r.difficulty) || 0);
      // Historical solution rate is only real when Wolf supplies a historical
      // sample. Never derive it from an inherited difficulty constant.
      const currentSolutionRate = await callZebraRPC('getnetworksolps', [120]).catch(() => null);
      const fees = rows.map((r) => (parseInt(r.total_fees, 10) || 0) / 1e8);
      const txCounts = rows.map((r) => parseInt(r.transaction_count, 10) || 0);

      const rollDiff = rollingAverage(difficulties, window);
      const rollBlockTime = rollingAverage(intervals, window);
      const rollFees = rollingAverage(fees, window);
      const rollTx = rollingAverage(txCounts, window);

      const points = rows.map((r, i) => ({
        height: parseInt(r.height, 10),
        difficulty: rollDiff[i],
        solrate: i === rows.length - 1 && Number.isFinite(Number(currentSolutionRate))
          ? Number(currentSolutionRate)
          : null,
        blockTime: rollBlockTime[i],
        txFees: rollFees[i],
        txCount: rollTx[i],
      }));

      const latest = points[points.length - 1] || {};

      res.json({
        success: true,
        ...wcashIdentity(),
        window,
        latest: {
          solrate: latest.solrate ?? null,
          difficulty: latest.difficulty ?? 0,
          blockTime: latest.blockTime ?? 75,
          txFees: latest.txFees ?? 0,
          txCount: latest.txCount ?? 0,
        },
        points,
      });
    } catch (error) {
      logSafeError('❌ [MINING-METRICS] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch mining metrics' });
    }
  });

  // Long-range network solution-rate trend. Wolf may not expose historical
  // getnetworksolps samples; return null historical points instead of a
  // fabricated difficulty conversion.
  router.get('/api/network/hashrate-history', async (req, res) => {
    try {
      const pool = req.app.locals.pool;
      const callZebraRPC = req.app.locals.callZebraRPC;
      const redisClient = req.app.locals.redisClient;
      const period = req.query.period || '90d';
      const cacheKey = `network:hashrate-history:${period}`;

      const cached = await getFromRedisCache(redisClient, cacheKey);
      if (cached) return res.json({ ...cached, cached: true });

      const interval = periodToInterval(period);
      const dateFilter =
        interval == null
          ? `timestamp >= 0`
          : `timestamp >= EXTRACT(EPOCH FROM NOW() - INTERVAL '${interval}')`;

      const latest = await callZebraRPC('getnetworksolps', [120]).catch(() => null);
      const result = await pool.query(`
        SELECT date_trunc('day', to_timestamp(timestamp)) AS day,
               COUNT(*) AS block_count
        FROM blocks
        WHERE ${dateFilter}
        GROUP BY day
        ORDER BY day ASC
      `);

      const points = result.rows.map((r, index) => ({
        date: r.day.toISOString().slice(0, 10),
        blockCount: parseInt(r.block_count, 10) || 0,
        solutionRate: index === result.rows.length - 1 && Number.isFinite(Number(latest))
          ? Number(latest)
          : null,
      }));

      const response = {
        success: true,
        network: 'wcash',
        ticker: 'TWC',
        period,
        available: Number.isFinite(Number(latest)),
        source: 'wolf:getnetworksolps',
        points,
        note: 'Wolf exposes the current solution rate; historical points remain null until historical node samples are stored.',
      };
      await setRedisCache(redisClient, cacheKey, response, 600); // 10 min
      res.json(response);
    } catch (error) {
      logSafeError('❌ [HASHRATE-HISTORY] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch hashrate history' });
    }
  });

  router.get('/api/network/pool-history', async (req, res) => {
    try {
      const pool = req.app.locals.pool;
      const period = req.query.period || '1y';
      const format = req.query.format || 'twc'; // 'twc' (default) or 'zatoshi'
      const useZat = format === 'zatoshi';
      const interval = periodToInterval(period);
      const hasIronwoodCol = await columnExists(pool, 'privacy_trends_daily', 'ironwood_pool_size');
      const hasTransparentCol = await columnExists(pool, 'privacy_trends_daily', 'transparent_pool_size');

      const cols = `date, pool_size, shielded_percentage, chain_supply,
        ${hasIronwoodCol ? 'ironwood_pool_size,' : ''}
        ${hasTransparentCol ? 'transparent_pool_size' : '0 AS transparent_pool_size'}`;

      const dateFilter = interval == null
        ? 'TRUE'
        : `date >= CURRENT_DATE - INTERVAL '${interval}'`;

      const result = await pool.query(
        `SELECT ${cols}
         FROM privacy_trends_daily
         WHERE ${dateFilter}
         ORDER BY date ASC`
      );

      const ZAT = 1e8;
      const points = result.rows.map((r) => {
        const ironwoodZat = hasIronwoodCol ? (parseInt(r.ironwood_pool_size, 10) || 0) : 0;
        const transparentZat = hasTransparentCol ? (parseInt(r.transparent_pool_size, 10) || 0) : 0;
        // W.cash has one shielded pool. Once the W.cash column exists, use it
        // as the canonical total instead of trusting the inherited generic
        // pool_size column if an old migration left it stale.
        const shieldedZat = hasIronwoodCol ? ironwoodZat : (parseInt(r.pool_size, 10) || 0);
        const chainSupplyZat = parseInt(r.chain_supply, 10) || 0;

        if (useZat) {
          return {
            date: r.date,
            shieldedZat: shieldedZat.toString(),
            ironwoodZat: ironwoodZat.toString(),
            transparentZat: transparentZat.toString(),
            chainSupplyZat: chainSupplyZat > 0 ? chainSupplyZat.toString() : null,
            shieldedSupplyPct: computeShieldedSupplyPct({
              shieldedZat,
              chainSupplyZat,
              transparentZat,
            }),
            hasPoolBreakdown: hasIronwoodCol && hasTransparentCol,
          };
        }

        const shielded = shieldedZat / ZAT;
        const chainSupply = chainSupplyZat / ZAT;

        return {
          date: r.date,
          shielded,
          ironwood: ironwoodZat / ZAT,
          transparent: transparentZat / ZAT,
          chainSupply: chainSupply > 0 ? chainSupply : null,
          shieldedSupplyPct: computeShieldedSupplyPct({
            shieldedZat,
            chainSupplyZat,
            transparentZat,
          }),
          hasPoolBreakdown: hasIronwoodCol && hasTransparentCol,
        };
      });

      const verifiedPerPool = hasIronwoodCol && hasTransparentCol
        ? await hasVerifiedPerPoolBreakdown(pool)
        : false;

      const coverageStart = points.length > 0 ? String(points[0].date).slice(0, 10) : null;
      const coverageEnd = points.length > 0 ? String(points[points.length - 1].date).slice(0, 10) : null;

      res.json({
        success: true,
        ...wcashIdentity(),
        period,
        format,
        points,
        timelineStart: coverageStart,
        coverageStart,
        coverageEnd,
        hasPoolBreakdown: hasIronwoodCol && hasTransparentCol,
        hasVerifiedPerPoolBreakdown: verifiedPerPool,
        source: 'canonical W.cash indexed snapshots',
        dataQuality: verifiedPerPool ? 'exact-indexed-snapshots' : 'unverified-or-empty',
      });
    } catch (error) {
      logSafeError('❌ [POOL-HISTORY] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch pool history' });
    }
  });

  router.get('/api/network/emission', async (req, res) => {
    try {
      const pool = req.app.locals.pool;
      const callZebraRPC = req.app.locals.callZebraRPC;
      const period = req.query.period || '1y';
      const interval = periodToInterval(period);
      const snapshotDateFilter = interval == null
        ? 'TRUE'
        : `snapshot_time >= NOW() - INTERVAL '${interval}'`;
      const trendDateFilter = interval == null
        ? 'TRUE'
        : `date >= CURRENT_DATE - INTERVAL '${interval}'`;

      let supplyPoints = [];
      if (await tableExists(pool, 'chain_snapshots')) {
        const snap = await pool.query(
          `SELECT snapshot_time, chain_supply_zat, block_height
           FROM chain_snapshots
           WHERE ${snapshotDateFilter}
           ORDER BY snapshot_time ASC`
        );
        supplyPoints = snap.rows.map((r) => ({
          date: r.snapshot_time,
          circulating: (parseInt(r.chain_supply_zat, 10) || 0) / 1e8,
          height: parseInt(r.block_height, 10),
        }));
      }

      const trends = await pool.query(
        `SELECT date, pool_size, chain_supply
         FROM privacy_trends_daily
         WHERE ${trendDateFilter}
         ORDER BY date ASC`
      );

      // Fall back to exact daily indexed snapshots when dedicated chain
      // snapshots are new or sparse. Do not interpolate between observations.
      if (supplyPoints.length < 2) {
        const fromTrends = trends.rows
          .filter((r) => r.chain_supply != null)
          .map((r) => ({
            date: r.date,
            circulating: parseInt(r.chain_supply, 10) / 1e8,
          }));
        if (fromTrends.length > supplyPoints.length) {
          supplyPoints = fromTrends;
        }
      }

      supplyPoints = supplyPoints.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const dailyEmission = [];
      for (let i = 1; i < trends.rows.length; i++) {
        const previousValue = trends.rows[i - 1].chain_supply;
        const currentValue = trends.rows[i].chain_supply;
        if (previousValue != null && currentValue != null) {
          const prev = BigInt(String(previousValue));
          const curr = BigInt(String(currentValue));
          dailyEmission.push({
            date: trends.rows[i].date,
            emission: Number(curr - prev) / 1e8,
          });
        }
      }

      const latestSupply = supplyPoints.length > 0
        ? supplyPoints[supplyPoints.length - 1].circulating
        : trends.rows.length > 0 && trends.rows[trends.rows.length - 1].chain_supply != null
          ? parseInt(trends.rows[trends.rows.length - 1].chain_supply, 10) / 1e8
          : null;

      const subsidy = await callZebraRPC('getblocksubsidy').catch(() => null);
      // Wolf's getblocksubsidy response is already denominated in the
      // network coin (TWC), unlike PostgreSQL's *_zat columns.
      const dailyEstimate = subsidy?.totalblocksubsidy != null
        ? Number(subsidy.totalblocksubsidy) * 1152
        : null;

      res.json({
        success: true,
        ...wcashIdentity(),
        available: latestSupply != null,
        maxSupply: MAX_SUPPLY_TWC,
        circulating: latestSupply,
        remaining: latestSupply == null ? null : MAX_SUPPLY_TWC - latestSupply,
        circulatingPct: latestSupply == null ? null : (latestSupply / MAX_SUPPLY_TWC) * 100,
        dailyEmissionEstimate: dailyEstimate,
        unit: 'TWC',
        coverageStart: supplyPoints.length > 0 ? String(supplyPoints[0].date) : null,
        coverageEnd: supplyPoints.length > 0 ? String(supplyPoints[supplyPoints.length - 1].date) : null,
        supplyHistory: supplyPoints,
        dailyEmission,
        hasChainSnapshots: await tableExists(pool, 'chain_snapshots'),
        supplyHistorySource: supplyPoints.length >= 2 ? 'history' : supplyPoints.length === 1 ? 'partial' : 'none',
        dataQuality: 'exact-indexed-snapshots; gaps are not interpolated',
        dailyEstimateIsForecast: dailyEstimate != null,
      });
    } catch (error) {
      logSafeError('❌ [EMISSION] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch emission data' });
    }
  });

  router.get('/api/network/chain-size-history', async (req, res) => {
    try {
      const pool = req.app.locals.pool;
      if (!(await tableExists(pool, 'chain_snapshots'))) {
        return res.json({ success: true, ...wcashIdentity(), points: [], available: false });
      }

      const period = req.query.period || '90d';
      const interval = periodToInterval(period);
      const dateFilter = interval == null
        ? 'TRUE'
        : `snapshot_time >= NOW() - INTERVAL '${interval}'`;

      const result = await pool.query(
        `SELECT snapshot_time, chain_size_bytes, block_height
         FROM chain_snapshots
         WHERE ${dateFilter}
         ORDER BY snapshot_time ASC`
      );

      res.json({
        success: true,
        ...wcashIdentity(),
        available: true,
        period,
        source: 'sum of serialized canonical W.cash block bytes',
        points: result.rows.map((r) => ({
          time: r.snapshot_time,
          sizeBytes: parseInt(r.chain_size_bytes, 10) || 0,
          sizeGB: (parseInt(r.chain_size_bytes, 10) || 0) / (1024 ** 3),
          height: parseInt(r.block_height, 10),
        })),
      });
    } catch (error) {
      logSafeError('❌ [CHAIN-SIZE] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch chain size history' });
    }
  });

  router.get('/api/network/blocks/recent', async (req, res) => {
    try {
      const pool = req.app.locals.pool;
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);

      const result = await pool.query(
        `SELECT
          b.height, b.hash, b.timestamp, b.transaction_count, b.size,
          b.miner_address, b.total_fees,
          c.total_output AS coinbase_zat
         FROM blocks b
         LEFT JOIN transactions c ON c.block_height = b.height AND c.is_coinbase = true
         ORDER BY b.height DESC
         LIMIT $1`,
        [limit]
      );

      res.json({
        success: true,
        ...wcashIdentity(),
        blocks: result.rows.map((r) => ({
          height: parseInt(r.height, 10),
          hash: r.hash,
          timestamp: parseInt(r.timestamp, 10),
          txCount: parseInt(r.transaction_count, 10) || 0,
          size: parseInt(r.size, 10) || 0,
          minerAddress: r.miner_address,
          fees: (parseInt(r.total_fees, 10) || 0) / 1e8,
          minerReward: (parseInt(r.coinbase_zat, 10) || 0) / 1e8,
        })),
      });
    } catch (error) {
      logSafeError('❌ [RECENT-BLOCKS] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch recent blocks' });
    }
  });
}

module.exports = { registerNetworkAnalyticsRoutes, discoverNextHalving };
