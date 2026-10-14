/**
 * Network Routes
 * /api/network/stats, /api/network/fees, /api/network/health, /api/network/peers
 */

const express = require('express');
const router = express.Router();
const { registerNetworkAnalyticsRoutes } = require('./network-analytics');
const { parsePeerClient } = require('../../lib/peer-client');
const { parseSafeListPagination, offsetExceededError } = require('../lib/pagination');
const { logSafeError } = require('../lib/safe-log');
const { applyListCacheHeaders } = require('../list-cache');
const { getWcashBase58Prefixes } = require('../lib/wcash-profile');

// The crawled node census is bounded to the live network's peer count
// (thousands, not millions), but the shared cap still applies for
// consistency and to guard against future growth (e.g. historical node
// tracking).
const MAX_NODES_OFFSET = 50_000;

// Dependencies injected via middleware
let pool;
let callZebraRPC;
let redisClient;
let listCache;

const NODE_SOURCE = process.env.NODE_SOURCE || 'peer';
const NODES_TABLE = 'nodes';

// Middleware to inject dependencies
router.use((req, res, next) => {
  pool = req.app.locals.pool;
  callZebraRPC = req.app.locals.callZebraRPC;
  redisClient = req.app.locals.redisClient;
  listCache = req.app.locals.listCache;
  next();
});

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const NETWORK_STATS_CACHE_KEY = 'wcash:network_stats';
const NETWORK_STATS_CACHE_DURATION = 120; // 2 minutes — network stats don't change fast
const NETWORK_HEALTH_CACHE_KEY = 'wcash:network_health';
const NETWORK_HEALTH_CACHE_DURATION = 60;
const NETWORK_TOPOLOGY_CACHE_KEY = 'wcash:network_topology';
const NETWORK_TOPOLOGY_CACHE_DURATION = 300; // 5 minutes — aligned with crawler ingest cycle

// Fallback in-memory cache (if Redis fails)
let networkStatsCache = null;
let networkStatsCacheTime = 0;

async function getOrLoadRoute(options) {
  if (listCache?.getOrLoad) return listCache.getOrLoad(options);
  const value = await options.load({
    measure: async (_name, operation) => operation(),
  });
  return {
    value,
    state: 'BYPASS',
    cacheDurationMs: 0,
    loadTimings: [],
    totalDurationMs: 0,
    refreshScheduled: false,
  };
}

/**
 * Get data from Redis cache
 */
async function getFromRedisCache(key) {
  try {
    if (!redisClient || !redisClient.isOpen) {
      return null;
    }
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logSafeError('Redis GET error:', err);
    return null;
  }
}

/**
 * Set data in Redis cache with TTL
 */
async function setInRedisCache(key, data, ttlSeconds) {
  try {
    if (!redisClient || !redisClient.isOpen) {
      return false;
    }
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
    return true;
  } catch (err) {
    logSafeError('Redis SET error:', err);
    return false;
  }
}

/**
 * Fetch network stats (optimized - 1 PostgreSQL query + 1 RPC call)
 */
async function fetchNetworkStatsOptimized() {
  try {
    // Single optimized PostgreSQL query (FAST!)
    const dbStats = await pool.query(`
      WITH latest AS (
        SELECT height, timestamp, difficulty
        FROM blocks
        ORDER BY height DESC
        LIMIT 1
      ),
      last_24h AS (
        SELECT
          COUNT(*) as blocks_24h,
          AVG(difficulty) as avg_difficulty,
          SUM(transaction_count) as tx_24h,
          -- transaction_count includes each block's mandatory coinbase tx,
          -- which would otherwise inflate "txs per block" with a transaction
          -- nobody sent — exactly one coinbase per block, so COUNT(*) is the
          -- exact amount to subtract, no separate transactions-table query.
          SUM(transaction_count) - COUNT(*) as tx_24h_excl_coinbase,
          AVG(total_fees) as avg_block_fee_zat
        FROM blocks
        WHERE timestamp >= EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')
      ),
      rolling_block_time AS (
        SELECT (MAX(timestamp) - MIN(timestamp))::float / NULLIF(COUNT(*) - 1, 0) AS avg_secs
        FROM (SELECT timestamp FROM blocks ORDER BY height DESC LIMIT 1000) sub
      ),
      latest_metric AS (
        SELECT serialized_bytes
        FROM wcash_block_metrics
        ORDER BY height DESC
        LIMIT 1
      )
      SELECT
        latest.height,
        latest.difficulty,
        latest.timestamp,
        last_24h.blocks_24h,
        last_24h.avg_difficulty,
        last_24h.tx_24h,
        last_24h.tx_24h_excl_coinbase,
        last_24h.avg_block_fee_zat,
        rolling_block_time.avg_secs AS rolling_block_time_secs,
        latest_metric.serialized_bytes
      FROM latest, last_24h, rolling_block_time
      LEFT JOIN latest_metric ON TRUE
    `);

    if (!dbStats.rows[0]) {
      throw new Error('No blockchain data available');
    }

    const {
      height,
      difficulty,
      timestamp,
      blocks_24h,
      avg_difficulty,
      tx_24h,
      tx_24h_excl_coinbase,
      avg_block_fee_zat,
      rolling_block_time_secs,
      serialized_bytes,
    } = dbStats.rows[0];

    const [networkInfo, peerInfo, blockchainInfo, blockSubsidy] = await Promise.all([
      callZebraRPC('getnetworkinfo').catch(() => null),
      callZebraRPC('getpeerinfo').catch(() => []),
      callZebraRPC('getblockchaininfo').catch(() => null),
      callZebraRPC('getblocksubsidy').catch(() => null),
    ]);

    // Extract peer count and network details
    const peerCount = networkInfo?.connections || (Array.isArray(peerInfo) ? peerInfo.length : 0);
    const protocolVersion = networkInfo?.protocolversion || null;
    const subversion = networkInfo?.subversion || null;

    // Extract only W.cash's live value pools from getblockchaininfo. Wolf's
    // response may contain compatibility fields from its upstream ancestry;
    // never pass those foreign pools through to the explorer.
    let supplyData = null;
    if (blockchainInfo) {
      const finiteZatoshi = (value) => {
        const number = Number(value);
        return Number.isSafeInteger(number) && number >= 0 ? number : null;
      };
      const chainSupplyZat = finiteZatoshi(blockchainInfo.chainSupply?.chainValueZat);
      const valuePools = Array.isArray(blockchainInfo.valuePools) ? blockchainInfo.valuePools : [];

      const transparent = finiteZatoshi(valuePools.find(p => p.id === 'transparent')?.chainValueZat);
      const ironwood = finiteZatoshi(valuePools.find(p => p.id === 'ironwood')?.chainValueZat);
      const totalShielded = ironwood;
      const shieldedPercentage = chainSupplyZat > 0 && totalShielded != null
        ? (totalShielded / chainSupplyZat) * 100
        : null;

      supplyData = {
        chainSupply: chainSupplyZat == null ? null : chainSupplyZat / 100000000,
        transparent: transparent == null ? null : transparent / 100000000,
        ironwood: ironwood == null ? null : ironwood / 100000000,
        totalShielded: totalShielded == null ? null : totalShielded / 100000000,
        shieldedPercentage: shieldedPercentage,
        sizeOnDisk: finiteZatoshi(blockchainInfo.size_on_disk),
        chain: blockchainInfo.chain || null,
      };
    }

    // Use Wolf's authoritative solution-rate RPC. Difficulty-to-rate formulas
    // are chain-specific and must not be inherited from another explorer.
    const blocks24h = parseInt(blocks_24h || 0);
    const tx24h = parseInt(tx_24h || 0);
    const tx24hExclCoinbase = parseInt(tx_24h_excl_coinbase || 0);
    const avgBlockTime = rolling_block_time_secs
      ? Math.round(Number(rolling_block_time_secs) * 10) / 10
      : (blocks24h > 0 ? Math.round(86400 / blocks24h) : null);
    const difficultyNum = parseFloat(difficulty || 0);
    const networkHashrateResult = await callZebraRPC('getnetworksolps', [120]).catch(() => null);
    const networkHashrate = Number.isFinite(Number(networkHashrateResult))
      ? Number(networkHashrateResult)
      : null;
    const avgBlockFee = avg_block_fee_zat != null ? parseFloat(avg_block_fee_zat) / 100000000 : null;
    const indexedHeight = Number.parseInt(height, 10);
    const nodeHeight = Number.isSafeInteger(Number(blockchainInfo?.blocks))
      ? Number(blockchainInfo.blocks)
      : null;
    const syncProgress = nodeHeight == null || nodeHeight < indexedHeight
      ? null
      : nodeHeight === 0
        ? 100
        : Number(((indexedHeight / nodeHeight) * 100).toFixed(2));
    const serializedChainBytes = Number.parseInt(serialized_bytes, 10) || 0;
    const operationalDiskBytes = Number.parseInt(blockchainInfo?.size_on_disk, 10) || 0;

    function formatHashrate(h) {
      if (!Number.isFinite(h)) return '—';
      if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TSol/s`;
      if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GSol/s`;
      if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MSol/s`;
      if (h >= 1e3) return `${(h / 1e3).toFixed(2)} KSol/s`;
      return `${h.toFixed(2)} Sol/s`;
    }

    // Block subsidy from Wolf RPC (dynamic, adjusts at halvings). Do not
    // invent a reward while the node is unavailable.
    const totalBlockSubsidy = blockSubsidy?.totalblocksubsidy != null
      ? Number(blockSubsidy.totalblocksubsidy)
      : null;
    const minerReward = blockSubsidy?.miner != null ? Number(blockSubsidy.miner) : totalBlockSubsidy;
    const dailyRevenue = totalBlockSubsidy == null ? null : blocks24h * totalBlockSubsidy;
    const dailyMinerRevenue = minerReward == null ? null : blocks24h * minerReward;

    return {
      success: true,
      chain: 'wcash',
      ticker: 'TWC',
      dataNetwork: process.env.WCASH_CHAIN || 'wcash-testnet-v5',
      mining: {
        networkHashrate: formatHashrate(networkHashrate),
        networkHashrateRaw: networkHashrate,
        difficulty: difficultyNum,
        avgBlockTime, // in seconds
        avgBlockFee, // in TWC, null if no blocks in the last 24h
        blocks24h,
        blockReward: totalBlockSubsidy,
        minerReward,
        dailyRevenue,
        dailyMinerRevenue,
      },
      network: {
        peers: peerCount,
        height: indexedHeight,
        nodeHeight,
        protocolVersion: protocolVersion,
        subversion: subversion,
      },
      blockchain: {
        height: indexedHeight,
        indexedHeight,
        nodeHeight,
        latestBlockTime: parseInt(timestamp),
        syncProgress,
        // This is the sum of canonical serialized W.cash block bytes. Wolf's
        // operational state directory size is exposed separately below.
        sizeBytes: serializedChainBytes,
        sizeGB: parseFloat((serializedChainBytes / (1024 * 1024 * 1024)).toFixed(2)),
        sizeKind: 'indexed_canonical_serialized_blocks',
        operationalDiskBytes,
        operationalDiskGB: parseFloat((operationalDiskBytes / (1024 * 1024 * 1024)).toFixed(2)),
        tx24h,
        tx24hExclCoinbase,
      },
      supply: supplyData,
      timestamp: Date.now(),
    };
  } catch (error) {
    logSafeError('❌ [NETWORK] Error fetching stats:', error);
    throw error;
  }
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/network/stats
 * Get network statistics (cached for 30s)
 */
router.get('/api/network/stats', async (req, res) => {
  try {
    // Try Redis cache first
    const cachedData = await getFromRedisCache(NETWORK_STATS_CACHE_KEY);
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        source: 'redis',
      });
    }

    // Fallback to in-memory cache
    const now = Date.now();
    if (networkStatsCache && (now - networkStatsCacheTime) < (NETWORK_STATS_CACHE_DURATION * 1000)) {
      return res.json({
        ...networkStatsCache,
        cached: true,
        source: 'memory',
      });
    }

    // Fetch fresh data
    const stats = await fetchNetworkStatsOptimized();
    stats.apiEndpoints = req.app.locals.apiRouteCount || null;

    // Update Redis cache
    await setInRedisCache(NETWORK_STATS_CACHE_KEY, stats, NETWORK_STATS_CACHE_DURATION);

    // Update in-memory cache (fallback)
    networkStatsCache = stats;
    networkStatsCacheTime = now;

    res.json(stats);
  } catch (error) {
    logSafeError('❌ [NETWORK] Error in API endpoint:', error);

    // Try Redis cache as fallback
    const cachedData = await getFromRedisCache(NETWORK_STATS_CACHE_KEY);
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        stale: true,
        source: 'redis',
        warning: 'Using stale Redis data due to fetch error',
      });
    }

    // Try in-memory cache as last resort
    if (networkStatsCache) {
      return res.json({
        ...networkStatsCache,
        cached: true,
        stale: true,
        source: 'memory',
        warning: 'Using stale memory data due to fetch error',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch network stats',
    });
  }
});

/**
 * GET /api/network/fees
 * Wcash fee policy is not a scanner-owned market estimate. Do not expose the
 * inherited foreign-chain constants as if they were Wcash consensus data.
 */
router.get('/api/network/fees', async (req, res) => {
  res.json({
    success: true,
    network: 'wcash',
    ticker: 'TWC',
    dataNetwork: process.env.WCASH_CHAIN || 'wcash-testnet-v5',
    available: false,
    fees: null,
    unit: 'TWC',
    source: 'W.cash Wolf fee policy',
    note: 'WcashExplorer does not invent a fee estimate. Fee data will appear when the W.cash node exposes a configured fee policy.',
    timestamp: Date.now(),
  });
});

/**
 * GET /api/network/health
 * Get W.cash Wolf node health status.
 */
router.get('/api/network/health', async (req, res) => {
  try {
    const cached = await getFromRedisCache(NETWORK_HEALTH_CACHE_KEY);
    if (cached) {
      return res.json({ ...cached, network: 'wcash', ticker: 'TWC', cached: true });
    }

    const wolfHealthUrl = process.env.WCASH_HEALTH_URL
      || process.env.WOLF_HEALTH_URL
      || 'http://127.0.0.1:8080';

    const [healthyRes, readyRes] = await Promise.allSettled([
      fetch(`${wolfHealthUrl}/healthy`).then(r => ({ status: r.status, ok: r.ok })).catch(() => null),
      fetch(`${wolfHealthUrl}/ready`).then(r => ({ status: r.status, ok: r.ok })).catch(() => null),
    ]);

    const healthy = healthyRes.status === 'fulfilled' && healthyRes.value?.ok;
    const ready = readyRes.status === 'fulfilled' && readyRes.value?.ok;

    let fallbackHealthy = false;
    if (!healthy) {
      try {
        const blockchainInfo = await callZebraRPC('getblockchaininfo');
        fallbackHealthy = blockchainInfo && blockchainInfo.blocks > 0;
      } catch (error) {
        fallbackHealthy = false;
      }
    }

    const result = {
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      dataNetwork: process.env.WCASH_CHAIN || 'wcash-testnet-v5',
      wolf: {
        healthy: healthy || fallbackHealthy,
        ready: ready,
        healthEndpointAvailable: healthy,
        readyEndpointAvailable: ready,
      },
      timestamp: Date.now(),
    };

    await setInRedisCache(NETWORK_HEALTH_CACHE_KEY, result, NETWORK_HEALTH_CACHE_DURATION);
    res.json(result);
  } catch (error) {
    logSafeError('❌ [HEALTH] Error checking health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check node health',
    });
  }
});

/**
 * GET /api/network/peers
 * Get privacy-preserving aggregate information about connected peers.
 */
router.get('/api/network/peers', async (req, res) => {
  try {
    console.log('🌐 [PEERS] Fetching peer information...');

    // Get detailed peer info from Wolf
    const peerInfo = await callZebraRPC('getpeerinfo').catch(() => []);

    if (!Array.isArray(peerInfo)) {
      return res.json({
        success: true,
        network: 'wcash',
        ticker: 'TWC',
        count: 0,
        peers: [],
      });
    }

    const clientCounts = {};
    let inbound = 0;
    let outbound = 0;
    let pingTotal = 0;
    let pingSamples = 0;
    for (const peer of peerInfo) {
      const { clientImpl } = parsePeerClient(peer.subver);
      clientCounts[clientImpl] = (clientCounts[clientImpl] || 0) + 1;
      if (peer.inbound) inbound++;
      else outbound++;
      if (Number.isFinite(peer.pingtime) && peer.pingtime >= 0) {
        pingTotal += peer.pingtime * 1000;
        pingSamples++;
      }
    }

    res.json({
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      count: peerInfo.length,
      inbound,
      outbound,
      avgPingMs: pingSamples > 0 ? Number((pingTotal / pingSamples).toFixed(1)) : null,
      clientDistribution: Object.entries(clientCounts)
        .map(([client, count]) => ({ client, count }))
        .sort((a, b) => b.count - a.count || a.client.localeCompare(b.client)),
      timestamp: Date.now(),
    });

    console.log(`✅ [PEERS] Returned aggregates for ${peerInfo.length} peers`);
  } catch (error) {
    logSafeError('❌ [PEERS] Error fetching peers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch peer information',
    });
  }
});

// ============================================================================
// TRANSPARENT SUPPLY BREAKDOWN
// ============================================================================

const BREAKDOWN_CACHE_KEY = 'wcash:transparent_breakdown';
const BREAKDOWN_CACHE_DURATION = 600; // 10 minutes

router.get('/api/supply/transparent-breakdown', async (req, res) => {
  try {
    const { p2pkh, p2sh } = getWcashBase58Prefixes();
    const cached = await getFromRedisCache(BREAKDOWN_CACHE_KEY);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const [categoryResult, addressTypeResult, blockchainInfo] = await Promise.all([
      pool.query(
        `SELECT COALESCE(l.category, 'unlabeled') AS category,
                COUNT(*)::int AS address_count,
                COALESCE(SUM(a.balance), 0) AS total_balance
         FROM addresses a
         LEFT JOIN address_labels l ON a.address = l.address
         WHERE a.balance > 0
         GROUP BY COALESCE(l.category, 'unlabeled')
         ORDER BY total_balance DESC`
      ),
      pool.query(
        `SELECT
           CASE
             WHEN address LIKE '${p2pkh}%' THEN 'P2PKH'
             WHEN address LIKE '${p2sh}%' THEN 'P2SH'
             ELSE 'other'
           END AS script_type,
           COUNT(*)::int AS address_count,
           COALESCE(SUM(balance), 0) AS total_balance
         FROM addresses
         WHERE balance > 0
         GROUP BY script_type
         ORDER BY total_balance DESC`
      ),
      callZebraRPC('getblockchaininfo').catch(() => null),
    ]);

    const transparentZat = blockchainInfo?.valuePools?.find(p => p.id === 'transparent')?.chainValueZat || 0;
    const transparentTotal = transparentZat / 1e8;

    let labeledTotal = 0;
    const categories = categoryResult.rows.map(row => {
      const balance = parseFloat(row.total_balance) / 1e8;
      if (row.category !== 'unlabeled') labeledTotal += balance;
      return {
        category: row.category,
        addressCount: row.address_count,
        totalBalance: balance,
        percentage: transparentTotal > 0 ? (balance / transparentTotal) * 100 : 0,
      };
    });

    const addressTypes = addressTypeResult.rows.map(row => {
      const balance = parseFloat(row.total_balance) / 1e8;
      return {
        type: row.script_type,
        description: row.script_type === 'P2PKH' ? 'Pay-to-Public-Key-Hash (Wcash transparent)' :
                     row.script_type === 'P2SH' ? 'Pay-to-Script-Hash (Wcash transparent)' : 'Other',
        addressCount: row.address_count,
        totalBalance: balance,
        percentage: transparentTotal > 0 ? (balance / transparentTotal) * 100 : 0,
      };
    });

    const result = {
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      dataNetwork: process.env.WCASH_CHAIN || 'wcash-testnet-v5',
      categories,
      addressTypes,
      transparentTotal,
      labeledTotal,
      labeledPercentage: transparentTotal > 0 ? (labeledTotal / transparentTotal) * 100 : 0,
      timestamp: Date.now(),
    };

    await setInRedisCache(BREAKDOWN_CACHE_KEY, result, BREAKDOWN_CACHE_DURATION);
    res.json(result);
  } catch (error) {
    logSafeError('Error fetching transparent breakdown:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transparent breakdown' });
  }
});

// ============================================================================
// SUPPLY & BLOCKCHAIN INFO APIs
// ============================================================================

/**
 * GET /api/supply
 * Get W.cash value pool breakdown. Wolf may expose additional fields in
 * verbose RPC responses; only the two W.cash pools are published here.
 */
router.get('/api/supply', async (req, res) => {
  try {
    const blockchainInfo = await callZebraRPC('getblockchaininfo');

    if (!blockchainInfo || !blockchainInfo.valuePools) {
      return res.status(500).json({ error: 'Could not fetch supply data' });
    }

    const pools = blockchainInfo.valuePools
      .filter(pool => pool.id === 'transparent' || pool.id === 'ironwood')
      .map(pool => ({
      id: pool.id,
      chainValue: pool.chainValue,
      chainValueZat: pool.chainValueZat,
      monitored: pool.monitored,
      }));

    res.json({
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      pools,
      // Keep the historical array under a named field rather than leaking
      // foreign-chain pool records into the public W.cash contract.
    });
  } catch (error) {
    logSafeError('❌ [SUPPLY] Error:', error);
    res.status(500).json({ error: 'Failed to fetch supply data' });
  }
});

/**
 * GET /api/blockchain-info
 * Full Wolf blockchain info with W.cash identity metadata.
 */
router.get('/api/blockchain-info', async (req, res) => {
  try {
    const [blockchainInfo, networkInfo, dbTip] = await Promise.all([
      callZebraRPC('getblockchaininfo'),
      callZebraRPC('getnetworkinfo').catch(() => null),
      pool.query('SELECT MAX(height) AS h FROM blocks').then(r =>
        r.rows.length ? Number(r.rows[0].h) || 0 : 0
      ).catch(() => null),
    ]);

    if (!blockchainInfo) {
      return res.status(500).json({ error: 'Could not fetch blockchain info' });
    }

    if (networkInfo?.subversion) {
      blockchainInfo.build = networkInfo.subversion;
    }

    // Return the indexed height so consumers never request unindexed blocks
    if (dbTip !== null) {
      blockchainInfo.blocks = dbTip;
      blockchainInfo.estimatedheight = dbTip;
    }

    const publicBlockchainInfo = {
      ...blockchainInfo,
      // Wolf may expose compatibility pools inherited from another
      // protocol. The WcashExplorer contract publishes only W.cash pools.
      valuePools: Array.isArray(blockchainInfo.valuePools)
        ? blockchainInfo.valuePools.filter((pool) => pool?.id === 'transparent' || pool?.id === 'ironwood')
        : blockchainInfo.valuePools,
    };

    res.json({
      ...publicBlockchainInfo,
      network: 'wcash',
      ticker: 'TWC',
      dataNetwork: process.env.WCASH_CHAIN || 'wcash-testnet-v5',
    });
  } catch (error) {
    logSafeError('❌ [BLOCKCHAIN-INFO] Error:', error);
    res.status(500).json({ error: 'Failed to fetch blockchain info' });
  }
});

/**
 * GET /api/circulating-supply
 * Returns the canonical W.cash circulating supply. This is a chain metric,
 * not a market-data integration.
 */
router.get('/api/circulating-supply', async (req, res) => {
  try {
    const blockchainInfo = await callZebraRPC('getblockchaininfo');

    if (!blockchainInfo?.chainSupply) {
      return res.status(500).json({ error: 'Could not fetch supply data' });
    }

    const supply = blockchainInfo.chainSupply.chainValue;

    // If ?format=json, return JSON; otherwise plain text (for aggregators)
    if (req.query.format === 'json') {
      res.json({
        circulatingSupply: supply,
        circulatingSupplyZat: blockchainInfo.chainSupply.chainValueZat,
        maxSupply: 21000000,
        maxSupplyZat: 2100000000000000n.toString(),
        unit: 'TWC',
        network: 'wcash',
      });
    } else {
      res.type('text/plain').send(supply.toString());
    }
  } catch (error) {
    logSafeError('❌ [CIRCULATING-SUPPLY] Error:', error);
    res.status(500).json({ error: 'Failed to fetch circulating supply' });
  }
});

// ============================================================================
// NODE MAP (Aggregated by location for privacy)
// ============================================================================

/**
 * GET /api/network/nodes
 * Get node locations aggregated by city (for privacy)
 */
router.get('/api/network/nodes', async (req, res) => {
  try {
    // Return coarse geographic cells only: no IP, exact city, or precise
    // coordinates leave the server. `top_client`/`top_isp` are the most
    // common values *within the cell* (already-aggregate P2P handshake /
    // ASN data, same disclosure level as the Concentration Risk endpoint) —
    // never a raw IP.
    const cachedResult = await getOrLoadRoute({
      family: 'network-node-locations',
      params: { source: NODE_SOURCE },
      freshTtlSeconds: 300,
      staleTtlSeconds: 1800,
      load: async ({ measure }) => {
        const result = await measure('database_read', () => pool.query(`
          SELECT
            country,
            country_code,
            ROUND(lat::numeric, 0) as lat,
            ROUND(lon::numeric, 0) as lon,
            COUNT(*) as node_count,
            ROUND(AVG(ping_ms)::numeric, 1) as avg_ping_ms,
            MODE() WITHIN GROUP (ORDER BY client_impl) as top_client,
            MODE() WITHIN GROUP (ORDER BY isp) as top_isp
          FROM ${NODES_TABLE}
          WHERE is_active = TRUE AND lat IS NOT NULL
          GROUP BY country, country_code, ROUND(lat::numeric, 0), ROUND(lon::numeric, 0)
          ORDER BY node_count DESC
        `));
        return {
          success: true,
          locations: result.rows.map(row => ({
            country: row.country,
            countryCode: row.country_code,
            lat: parseFloat(row.lat),
            lon: parseFloat(row.lon),
            nodeCount: parseInt(row.node_count),
            avgPingMs: row.avg_ping_ms ? parseFloat(row.avg_ping_ms) : null,
            topClient: row.top_client || null,
            topIsp: row.top_isp || null,
          })),
          timestamp: Date.now(),
        };
      },
    });
    applyListCacheHeaders(res, cachedResult);
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800');
    res.json(cachedResult.value);
  } catch (error) {
    logSafeError('❌ [NODES] Error fetching node locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node locations',
    });
  }
});

/**
 * GET /api/network/nodes/stats
 * Get aggregated node statistics with Tor count, version distribution, and trends
 */
router.get('/api/network/nodes/stats', async (req, res) => {
  try {
    const cachedResult = await getOrLoadRoute({
      family: 'network-node-stats',
      params: { source: NODE_SOURCE },
      freshTtlSeconds: 300,
      staleTtlSeconds: 1800,
      load: async ({ measure }) => {
        const sourceFilter = NODE_SOURCE === 'crawl' ? '' : "AND observed_via = 'peer'";
        const [statsResult, topCountries, trends, clients, versions] = await measure(
          'database_read',
          () => Promise.all([
            pool.query(`
              SELECT
                COUNT(*) FILTER (WHERE is_active) as active_nodes,
                COUNT(*) as total_nodes,
                COUNT(DISTINCT country_code) FILTER (WHERE is_active) as countries,
                COUNT(DISTINCT city) FILTER (WHERE is_active) as cities,
                ROUND(AVG(ping_ms) FILTER (WHERE is_active AND ping_ms > 0)::numeric, 1) as avg_ping_ms,
                COUNT(*) FILTER (WHERE is_active AND is_tor) as tor_nodes,
                MAX(last_seen) as last_updated
              FROM ${NODES_TABLE}
            `),
            pool.query(`
              SELECT country_code, MODE() WITHIN GROUP (ORDER BY country) as country,
                     COUNT(*) as node_count
              FROM ${NODES_TABLE}
              WHERE is_active = TRUE AND country_code IS NOT NULL
              GROUP BY country_code
              ORDER BY node_count DESC
              LIMIT 10
            `),
            pool.query(`
              SELECT
                (SELECT active_nodes FROM node_snapshots
                 WHERE snapshot_time >= NOW() - INTERVAL '24 hours'
                 ORDER BY snapshot_time ASC LIMIT 1) as nodes_24h_ago,
                (SELECT active_nodes FROM node_snapshots
                 WHERE snapshot_time >= NOW() - INTERVAL '7 days'
                 ORDER BY snapshot_time ASC LIMIT 1) as nodes_7d_ago,
                (SELECT active_nodes FROM node_snapshots
                 WHERE snapshot_time >= NOW() - INTERVAL '30 days'
                 ORDER BY snapshot_time ASC LIMIT 1) as nodes_30d_ago
            `).catch(() => ({ rows: [{}] })),
            pool.query(`
              SELECT client_impl, COUNT(*)::int AS node_count
              FROM ${NODES_TABLE}
              WHERE is_active = TRUE ${sourceFilter}
              GROUP BY client_impl
              ORDER BY node_count DESC, client_impl ASC
            `),
            pool.query(`
              SELECT client_impl, client_version, COUNT(*)::int AS node_count
              FROM ${NODES_TABLE}
              WHERE is_active = TRUE ${sourceFilter} AND client_version IS NOT NULL
              GROUP BY client_impl, client_version
              ORDER BY node_count DESC, client_impl ASC, client_version DESC
              LIMIT 12
            `),
          ]),
        );

        const row = statsResult.rows[0];
        const activeNodes = parseInt(row.active_nodes) || 0;
        const trendRow = trends.rows[0] || {};
        const clientDistribution = clients.rows.map((client) => ({
          client: client.client_impl || 'Unknown',
          count: Number(client.node_count) || 0,
        }));
        const observedClientNodes = clientDistribution.reduce((sum, client) => sum + client.count, 0);
        const identifiedClientNodes = clientDistribution
          .filter((client) => client.client !== 'Unknown')
          .reduce((sum, client) => sum + client.count, 0);
        const calcChange = (prev) => {
          if (!prev || prev === 0) return null;
          return parseFloat(((activeNodes - prev) / prev * 100).toFixed(1));
        };

        return {
          success: true,
          stats: {
            activeNodes,
            totalNodes: parseInt(row.total_nodes) || 0,
            countries: parseInt(row.countries) || 0,
            cities: parseInt(row.cities) || 0,
            avgPingMs: row.avg_ping_ms ? parseFloat(row.avg_ping_ms) : null,
            torNodes: parseInt(row.tor_nodes) || 0,
            lastUpdated: row.last_updated,
          },
          trends: {
            change24h: calcChange(trendRow.nodes_24h_ago),
            change7d: calcChange(trendRow.nodes_7d_ago),
            change30d: calcChange(trendRow.nodes_30d_ago),
          },
          topCountries: topCountries.rows.map(r => ({
            country: r.country,
            countryCode: r.country_code,
            nodeCount: parseInt(r.node_count),
          })),
          clients: {
            observedNodes: observedClientNodes,
            identifiedNodes: identifiedClientNodes,
            coveragePercentage: observedClientNodes > 0
              ? Number(((identifiedClientNodes / observedClientNodes) * 100).toFixed(1))
              : 0,
            distribution: clientDistribution,
            versions: versions.rows.map((version) => ({
              client: version.client_impl || 'Unknown',
              version: version.client_version,
              count: Number(version.node_count) || 0,
            })),
          },
          timestamp: Date.now(),
        };
      },
    });
    applyListCacheHeaders(res, cachedResult);
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800');
    res.json(cachedResult.value);
  } catch (error) {
    logSafeError('❌ [NODES] Error fetching node stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node stats',
    });
  }
});

/**
 * GET /api/network/node-history?period=30d
 * Get historical node count snapshots for charting
 */
router.get('/api/network/node-history', async (req, res) => {
  try {
    const period = req.query.period || '30d';
    const intervalMap = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
    const interval = intervalMap[period] || '30 days';

    const result = await pool.query(`
      SELECT
        snapshot_time,
        active_nodes,
        tor_nodes,
        countries,
        inbound_nodes,
        outbound_nodes,
        avg_ping_ms,
        identified_client_nodes,
        client_counts
      FROM node_snapshots
      WHERE snapshot_time >= NOW() - INTERVAL '${interval}'
      ORDER BY snapshot_time ASC
    `);

    res.json({
      success: true,
      period,
      snapshots: result.rows.map(r => ({
        time: r.snapshot_time,
        activeNodes: r.active_nodes,
        torNodes: r.tor_nodes,
        countries: r.countries,
        inboundNodes: r.inbound_nodes,
        outboundNodes: r.outbound_nodes,
        avgPingMs: r.avg_ping_ms ? parseFloat(r.avg_ping_ms) : null,
        identifiedClientNodes: r.identified_client_nodes,
        clientCounts: r.client_counts || {},
      })),
      timestamp: Date.now(),
    });
  } catch (error) {
    logSafeError('❌ [NODE-HISTORY] Error fetching node history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node history',
    });
  }
});

// W.cash has no production price/valuation source. Keep these paths explicit
// and closed so old frontend bundles or third-party callers cannot silently
// re-enable a market-data dependency.
router.get(['/api/price', '/api/price/at'], (req, res) => {
  res.status(404).json({
    success: false,
    code: 'PRICING_DISABLED',
    error: 'Market pricing is disabled for WcashExplorer',
  });
});

// ============================================================================
// PROTOCOL STATS: Commitment trees & nullifier sets
// ============================================================================

const PROTOCOL_STATS_CACHE_KEY = 'wcash:protocol_stats';
const PROTOCOL_STATS_CACHE_DURATION = 300; // 5 minutes

router.get('/api/network/protocol-stats', async (req, res) => {
  try {
    const cached = await getFromRedisCache(PROTOCOL_STATS_CACHE_KEY);
    if (cached) return res.json({ ...cached, cached: true });

    const [totals, monthly] = await Promise.all([
      pool.query(`
        SELECT
          SUM(ironwood_actions)::bigint AS ironwood_actions
        FROM transactions
      `),
      pool.query(`
        SELECT
          date_trunc('month', to_timestamp(block_time))::date AS month,
          SUM(ironwood_actions)::bigint AS ironwood_actions
        FROM transactions
        WHERE block_time > 0
        GROUP BY month
        ORDER BY month
      `),
    ]);

    const t = totals.rows[0];

    let ironwoodCum = 0;
    const history = monthly.rows.map(row => {
      ironwoodCum += parseInt(row.ironwood_actions) || 0;
      return {
        month: row.month,
        ironwoodActions: ironwoodCum,
      };
    });

    const result = {
      success: true,
      network: 'wcash',
      ticker: 'TWC',
      current: {
        ironwoodActions: parseInt(t.ironwood_actions) || 0,
      },
      history,
      timestamp: Date.now(),
    };

    await setInRedisCache(PROTOCOL_STATS_CACHE_KEY, result, PROTOCOL_STATS_CACHE_DURATION);
    res.json(result);
  } catch (error) {
    logSafeError('Error fetching protocol stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch protocol stats' });
  }
});

// ============================================================================
// NETWORK TOPOLOGY (Phase 2)
// ============================================================================

/**
 * GET /api/network/topology
 * Returns an anonymized force-directed graph (node IDs + geo cells + centrality).
 * Never exposes raw IPs or .onion addresses.
 */
router.get('/api/network/topology', async (req, res) => {
  try {
    // Serve from Redis cache when available (topology data changes every ~5 min).
    const cached = await getFromRedisCache(NETWORK_TOPOLOGY_CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    // Full known-network graph: reachable core + connected "off" (gossiped but
    // unreachable) nodes. Reachable nodes get the richer client classification
    // from the nodes table; grey nodes fall back to the crawler-derived label.
    //
    // Privacy: topology_nodes.addr / ip are server-side identity/join keys only.
    // They are NEVER returned — the client receives a synthetic per-response id.
    // "Reachable" = we have a recent successful handshake. Use the accumulated
    // nodes table (is_active = last_seen < 1h) OR the crawler's live snapshot flag,
    // which keeps this consistent with the rest of the page and resilient to crawler
    // restarts (which reset the live handshake state).
    //
    // Nodes are collapsed to ONE per IP: the gossip graph lists the same host under
    // several ports, so keying by ip:port would double-count reachable nodes vs the
    // node list. We keep the highest-degree row per IP as its representative.
    const nodesResult = await pool.query(`
      SELECT
        tn.addr,
        tn.ip,
        (tn.reachable OR n.id IS NOT NULL) AS reachable,
        COALESCE(NULLIF(n.client_impl, 'Unknown'), NULLIF(tn.client_impl, 'Unknown')) AS client_impl,
        (tn.is_tor OR COALESCE(n.is_tor, FALSE)) AS is_tor,
        COALESCE(n.country_code, tn.country_code) AS country_code,
        tn.degree,
        tn.betweenness,
        tn.closeness
      FROM topology_nodes tn
      LEFT JOIN ${NODES_TABLE} n ON n.ip = tn.ip AND n.is_active = TRUE
      ORDER BY tn.degree DESC NULLS LAST
    `);

    // Collapse to one node per IP (keep the highest-degree representative; a node is
    // reachable if ANY of its addr entries is). Map every addr → its representative id
    // so edges can be rewritten into ip space. Never leak addr/ip to the client.
    const idByIp = new Map();
    const idByAddr = new Map();
    const nodes = [];
    for (const r of nodesResult.rows) {
      let id = idByIp.get(r.ip);
      if (id === undefined) {
        id = nodes.length;
        idByIp.set(r.ip, id);
        nodes.push({
          id,
          reachable: r.reachable === true,
          client: r.client_impl || null,
          isTor: r.is_tor === true,
          countryCode: r.country_code,
          betweenness: r.betweenness != null ? parseFloat(r.betweenness) : null,
          closeness: r.closeness != null ? parseFloat(r.closeness) : null,
          degree: r.degree != null ? parseInt(r.degree) : null,
        });
      } else if (r.reachable === true) {
        nodes[id].reachable = true;
      }
      idByAddr.set(r.addr, id);
    }

    const edgesResult = await pool.query('SELECT src, dst FROM topology_edges LIMIT 40000');

    // Rewrite edges into ip space, drop self-loops, and dedupe (undirected).
    const edges = [];
    const seenEdge = new Set();
    for (const e of edgesResult.rows) {
      const source = idByAddr.get(e.src);
      const target = idByAddr.get(e.dst);
      if (source === undefined || target === undefined || source === target) continue;
      const key = source < target ? `${source}-${target}` : `${target}-${source}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push({ source, target });
    }

    const reachableCount = nodes.filter(n => n.reachable).length;

    const response = {
      success: true,
      nodes,
      edges,
      counts: {
        total: nodes.length,
        reachable: reachableCount,
        off: nodes.length - reachableCount,
        edges: edges.length,
      },
      timestamp: Date.now(),
    };

    await setInRedisCache(NETWORK_TOPOLOGY_CACHE_KEY, response, NETWORK_TOPOLOGY_CACHE_DURATION);

    res.json(response);
  } catch (error) {
    logSafeError('Error fetching topology:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch topology' });
  }
});

/**
 * GET /api/network/nodes/list
 * Returns pseudonymized node list for the /network/nodes detail page.
 * Never exposes raw IPs or .onion addresses.
 */
router.get('/api/network/nodes/list', async (req, res) => {
  try {
    const { limit, offset, requestedOffset, offsetExceeded } = parseSafeListPagination(req.query, {
      defaultLimit: 100,
      maxLimit: 500,
      maxOffset: MAX_NODES_OFFSET,
    });

    if (offsetExceeded) {
      return res.status(400).json(offsetExceededError({ requestedOffset, maxOffset: MAX_NODES_OFFSET }));
    }

    const sortBy = req.query.sort || 'last_seen';
    const allowedSorts = ['last_seen', 'client_impl', 'country_code', 'protocol_version', 'ping_ms', 'degree'];
    const orderCol = allowedSorts.includes(sortBy) ? `n.${sortBy}` : 'n.last_seen';
    const orderDir = req.query.dir === 'asc' ? 'ASC' : 'DESC';

    const [nodesResult, countResult] = await Promise.all([
      pool.query(`
        SELECT
          n.id,
          COALESCE(n.client_impl, zn.client_impl) AS client_impl,
          COALESCE(n.client_version, zn.client_version) AS client_version,
          COALESCE(n.protocol_version, zn.protocol_version) AS protocol_version,
          n.country,
          n.country_code,
          ROUND(n.lat::numeric, 0) as lat,
          ROUND(n.lon::numeric, 0) as lon,
          n.is_tor,
          n.tor_type,
          n.ping_ms,
          n.is_active,
          n.first_seen,
          n.last_seen,
          n.observed_via,
          n.isp,
          n.degree,
          n.betweenness,
          n.closeness
        FROM ${NODES_TABLE} n
        LEFT JOIN nodes zn ON zn.ip = n.ip AND n.client_impl = 'Unknown' AND zn.client_impl IS NOT NULL AND zn.client_impl != 'Unknown'
        WHERE n.is_active = TRUE
        ORDER BY ${orderCol} ${orderDir} NULLS LAST
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM ${NODES_TABLE} WHERE is_active = TRUE`),
    ]);

    res.json({
      success: true,
      total: countResult.rows[0].total,
      nodes: nodesResult.rows.map(n => ({
        id: n.id,
        client: n.client_impl,
        version: n.client_version,
        protocolVersion: n.protocol_version,
        country: n.country,
        countryCode: n.country_code,
        lat: n.lat ? parseFloat(n.lat) : null,
        lon: n.lon ? parseFloat(n.lon) : null,
        isTor: n.is_tor,
        torType: n.tor_type,
        pingMs: n.ping_ms ? parseFloat(n.ping_ms) : null,
        isActive: n.is_active,
        firstSeen: n.first_seen,
        lastSeen: n.last_seen,
        source: n.observed_via,
        isp: n.isp,
        degree: n.degree,
        betweenness: n.betweenness ? parseFloat(n.betweenness) : null,
        closeness: n.closeness ? parseFloat(n.closeness) : null,
      })),
      timestamp: Date.now(),
    });
  } catch (error) {
    logSafeError('Error fetching node list:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch node list' });
  }
});

// ============================================================================
// NETWORK INTELLIGENCE ENDPOINTS
// ============================================================================

/**
 * GET /api/network/nodes/health-score
 * Composite network health metric derived from crawler data.
 */
router.get('/api/network/nodes/health-score', async (req, res) => {
  try {
    const [connectivityResult, versionResult, clientResult, geoResult, reliabilityResult] = await Promise.all([
      pool.query(`
        SELECT
          AVG(degree) FILTER (WHERE is_active AND degree > 0) AS avg_degree,
          MAX(degree) FILTER (WHERE is_active) AS max_degree,
          COUNT(*) FILTER (WHERE is_active AND degree <= 1) AS poorly_connected,
          COUNT(*) FILTER (WHERE is_active AND degree > 0) AS connected_nodes,
          COUNT(*) FILTER (WHERE is_active) AS total_active
        FROM nodes
      `),
      pool.query(`
        SELECT protocol_version, COUNT(*)::int AS cnt
        FROM nodes WHERE is_active = TRUE AND protocol_version IS NOT NULL
        GROUP BY protocol_version ORDER BY cnt DESC
      `),
      pool.query(`
        SELECT COALESCE(client_impl, 'Unidentified') AS client_impl, COUNT(*)::int AS cnt
        FROM nodes WHERE is_active = TRUE
        GROUP BY client_impl ORDER BY cnt DESC
      `),
      pool.query(`
        SELECT
          COUNT(DISTINCT country_code) FILTER (WHERE is_active AND country_code IS NOT NULL) AS countries,
          COUNT(DISTINCT SUBSTRING(ip FROM '^[0-9]+\\.[0-9]+\\.[0-9]+')) FILTER (WHERE is_active) AS unique_subnets
        FROM nodes
      `),
      pool.query(`
        SELECT
          AVG(crawl_seen_count::numeric / NULLIF(crawl_seen_count + COALESCE(crawl_miss_count, 0), 0))
            FILTER (WHERE is_active AND (crawl_seen_count + COALESCE(crawl_miss_count, 0)) >= 3) AS avg_reliability,
          COUNT(*) FILTER (WHERE is_active AND (crawl_seen_count + COALESCE(crawl_miss_count, 0)) >= 3) AS scored_nodes
        FROM nodes
      `),
    ]);

    const conn = connectivityResult.rows[0];
    const geo = geoResult.rows[0];
    const versions = versionResult.rows;
    const clients = clientResult.rows;
    const rel = reliabilityResult.rows[0];

    const totalActive = parseInt(conn.total_active) || 1;

    // Connectivity: based on avg peer degree (healthy mesh ~8+)
    const avgDegree = parseFloat(conn.avg_degree) || 0;
    const connectivityScore = Math.min(100, Math.round((avgDegree / 8) * 100));

    // Upgrade adoption: share of nodes on the latest protocol version
    const LATEST_PROTOCOL = 170160; // NU6.3
    const totalVersioned = versions.reduce((s, v) => s + v.cnt, 0) || 1;
    const latestCount = versions.filter(v => parseInt(v.protocol_version) >= LATEST_PROTOCOL).reduce((s, v) => s + v.cnt, 0);
    const upgradePct = (latestCount / totalVersioned) * 100;
    const upgradeScore = Math.round(upgradePct);

    // Client diversity: penalize implementation monoculture (single-client dominance)
    const identifiedClients = clients.filter(c => c.client_impl !== 'Unidentified' && c.client_impl !== 'Seeder');
    const totalIdentified = identifiedClients.reduce((s, c) => s + c.cnt, 0) || 1;
    const topClient = identifiedClients[0] || { client_impl: null, cnt: 0 };
    const topClientPct = (topClient.cnt / totalIdentified) * 100;
    const clientDiversityScore = topClientPct > 90 ? 40 : topClientPct > 75 ? 70 : topClientPct > 60 ? 85 : 100;

    // Geographic diversity: country spread (healthy ~30+)
    const countries = parseInt(geo.countries) || 0;
    const geoScore = Math.min(100, Math.round((countries / 30) * 100));

    // Reliability: how consistently reachable nodes are across crawl cycles
    const avgReliability = rel.avg_reliability != null ? parseFloat(rel.avg_reliability) : null;
    const reliabilityScore = avgReliability != null ? Math.round(avgReliability * 100) : 50;

    // Composite (weighted, honest signals only)
    const composite = Math.round(
      connectivityScore * 0.25 +
      upgradeScore * 0.20 +
      clientDiversityScore * 0.20 +
      geoScore * 0.15 +
      reliabilityScore * 0.20
    );

    res.json({
      success: true,
      healthScore: composite,
      components: {
        connectivity: { score: connectivityScore, avgDegree: parseFloat(avgDegree.toFixed(1)), poorlyConnected: parseInt(conn.poorly_connected) || 0, maxDegree: parseInt(conn.max_degree) || 0 },
        upgrade: { score: upgradeScore, latestProtocol: LATEST_PROTOCOL, adoptionPct: parseFloat(upgradePct.toFixed(1)), latestCount },
        clientDiversity: { score: clientDiversityScore, topClient: topClient.client_impl, topClientPct: parseFloat(topClientPct.toFixed(1)), implementations: identifiedClients.length },
        geographic: { score: geoScore, countries, uniqueSubnets: parseInt(geo.unique_subnets) || 0 },
        reliability: { score: reliabilityScore, avgReliabilityPct: avgReliability != null ? parseFloat((avgReliability * 100).toFixed(1)) : null, scoredNodes: parseInt(rel.scored_nodes) || 0 },
      },
      totalActive,
      timestamp: Date.now(),
    });
  } catch (error) {
    logSafeError('Error computing health score:', error);
    res.status(500).json({ success: false, error: 'Failed to compute health score' });
  }
});

/**
 * GET /api/network/nodes/reliability
 * Real per-node signals from the crawler: reachability across crawl cycles,
 * handshake latency distribution, and advertised service flags.
 */
router.get('/api/network/nodes/reliability', async (req, res) => {
  try {
    const [leaderboard, latencyDist, servicesDist, summary] = await Promise.all([
      pool.query(`
        SELECT
          id,
          COALESCE(client_impl, 'Unidentified') AS client_impl,
          country_code,
          country,
          ping_ms,
          crawl_seen_count,
          COALESCE(crawl_miss_count, 0) AS crawl_miss_count,
          ROUND((crawl_seen_count::numeric / NULLIF(crawl_seen_count + COALESCE(crawl_miss_count, 0), 0)) * 100, 1) AS reliability_pct
        FROM nodes
        WHERE is_active = TRUE AND (crawl_seen_count + COALESCE(crawl_miss_count, 0)) >= 3
        ORDER BY reliability_pct DESC NULLS LAST, crawl_seen_count DESC, ping_ms ASC NULLS LAST
        LIMIT 12
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ping_ms > 0 AND ping_ms < 50) AS b0,
          COUNT(*) FILTER (WHERE ping_ms >= 50 AND ping_ms < 100) AS b1,
          COUNT(*) FILTER (WHERE ping_ms >= 100 AND ping_ms < 200) AS b2,
          COUNT(*) FILTER (WHERE ping_ms >= 200 AND ping_ms < 500) AS b3,
          COUNT(*) FILTER (WHERE ping_ms >= 500) AS b4,
          ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY ping_ms) FILTER (WHERE ping_ms > 0)::numeric, 0) AS median_ms,
          COUNT(*) FILTER (WHERE ping_ms > 0) AS measured
        FROM nodes WHERE is_active = TRUE
      `),
      pool.query(`
        SELECT services, COUNT(*)::int AS cnt
        FROM nodes WHERE is_active = TRUE AND services IS NOT NULL
        GROUP BY services ORDER BY cnt DESC
      `),
      pool.query(`
        SELECT
          ROUND(AVG(crawl_seen_count::numeric / NULLIF(crawl_seen_count + COALESCE(crawl_miss_count, 0), 0))
            FILTER (WHERE (crawl_seen_count + COALESCE(crawl_miss_count, 0)) >= 3) * 100, 1) AS avg_reliability_pct,
          MAX(crawl_seen_count) AS max_seen,
          COUNT(*) FILTER (WHERE services IS NOT NULL) AS services_known
        FROM nodes WHERE is_active = TRUE
      `),
    ]);

    // Decode the NODE_NETWORK bit (0x1) — the flag that matters for full-node service.
    const NODE_NETWORK = 1;
    const svcRows = servicesDist.rows;
    const totalWithServices = svcRows.reduce((s, r) => s + r.cnt, 0);
    const fullNodeCount = svcRows
      .filter(r => (BigInt(r.services) & BigInt(NODE_NETWORK)) !== 0n)
      .reduce((s, r) => s + r.cnt, 0);

    const lat = latencyDist.rows[0];
    const sum = summary.rows[0];

    res.json({
      success: true,
      leaderboard: leaderboard.rows.map(r => ({
        id: r.id,
        client: r.client_impl,
        countryCode: r.country_code,
        country: r.country,
        pingMs: r.ping_ms != null ? parseFloat(r.ping_ms) : null,
        seen: parseInt(r.crawl_seen_count) || 0,
        missed: parseInt(r.crawl_miss_count) || 0,
        reliabilityPct: r.reliability_pct != null ? parseFloat(r.reliability_pct) : null,
      })),
      latency: {
        median: lat.median_ms != null ? parseInt(lat.median_ms) : null,
        measured: parseInt(lat.measured) || 0,
        buckets: [
          { label: '<50ms', count: parseInt(lat.b0) || 0 },
          { label: '50\u2013100ms', count: parseInt(lat.b1) || 0 },
          { label: '100\u2013200ms', count: parseInt(lat.b2) || 0 },
          { label: '200\u2013500ms', count: parseInt(lat.b3) || 0 },
          { label: '\u2265500ms', count: parseInt(lat.b4) || 0 },
        ],
      },
      services: {
        known: totalWithServices,
        fullNodes: fullNodeCount,
        fullNodePct: totalWithServices > 0 ? parseFloat(((fullNodeCount / totalWithServices) * 100).toFixed(1)) : 0,
      },
      avgReliabilityPct: sum.avg_reliability_pct != null ? parseFloat(sum.avg_reliability_pct) : null,
      maxSeen: parseInt(sum.max_seen) || 0,
      timestamp: Date.now(),
    });
  } catch (error) {
    logSafeError('Error fetching node reliability:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch node reliability' });
  }
});

/**
 * GET /api/network/nodes/upgrade-readiness
 * Protocol version adoption tracking.
 */
router.get('/api/network/nodes/upgrade-readiness', async (req, res) => {
  try {
    const [currentDist, historicalResult] = await Promise.all([
      pool.query(`
        SELECT
          protocol_version,
          COUNT(*)::int AS node_count,
          ARRAY_AGG(DISTINCT client_impl) AS clients,
          ROUND(AVG(degree) FILTER (WHERE degree > 0)::numeric, 1) AS avg_degree
        FROM nodes
        WHERE is_active = TRUE AND protocol_version IS NOT NULL
        GROUP BY protocol_version
        ORDER BY node_count DESC
      `),
      pool.query(`
        SELECT
          DATE(snapshot_time) AS day,
          client_counts
        FROM node_snapshots
        WHERE snapshot_time >= NOW() - INTERVAL '30 days'
        ORDER BY snapshot_time DESC
        LIMIT 30
      `).catch(() => ({ rows: [] })),
    ]);

    const totalActive = currentDist.rows.reduce((s, r) => s + r.node_count, 0) || 1;
    const LATEST_PROTOCOL = 170160; // NU6.3

    const versions = currentDist.rows.map(r => ({
      protocolVersion: parseInt(r.protocol_version),
      nodeCount: r.node_count,
      percentage: parseFloat(((r.node_count / totalActive) * 100).toFixed(1)),
      clients: r.clients.filter(c => c && c !== 'Unknown' && c !== 'Seeder'),
      avgDegree: r.avg_degree ? parseFloat(r.avg_degree) : null,
      isLatest: parseInt(r.protocol_version) >= LATEST_PROTOCOL,
    }));

    const latestCount = versions.filter(v => v.isLatest).reduce((s, v) => s + v.nodeCount, 0);
    const readinessPct = parseFloat(((latestCount / totalActive) * 100).toFixed(1));

    res.json({
      success: true,
      latestProtocol: LATEST_PROTOCOL,
      readinessPct,
      latestCount,
      totalActive,
      versions,
      timestamp: Date.now(),
    });
  } catch (error) {
    logSafeError('Error fetching upgrade readiness:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch upgrade readiness' });
  }
});

/**
 * GET /api/network/nodes/concentration
 * Sybil/concentration risk analysis — subnet and ASN clustering.
 */
router.get('/api/network/nodes/concentration', async (req, res) => {
  try {
    const [subnetResult, ispResult, highDegreeResult] = await Promise.all([
      pool.query(`
        SELECT
          SUBSTRING(ip FROM '^([0-9]+\\.[0-9]+\\.[0-9]+)') AS subnet,
          COUNT(*)::int AS node_count,
          ARRAY_AGG(DISTINCT client_impl) AS clients
        FROM nodes
        WHERE is_active = TRUE AND ip !~ ':' AND ip != '127.0.0.1'
        GROUP BY subnet
        HAVING COUNT(*) >= 3
        ORDER BY node_count DESC
        LIMIT 15
      `),
      pool.query(`
        SELECT
          COALESCE(isp, 'Unresolved') AS isp,
          COUNT(*)::int AS node_count,
          ROUND((COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM nodes WHERE is_active), 0)) * 100, 1) AS pct
        FROM nodes
        WHERE is_active = TRUE
        GROUP BY isp
        ORDER BY node_count DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE degree > 50 AND is_active) AS high_degree_nodes,
          COUNT(*) FILTER (WHERE is_active AND degree > 0) AS total_with_degree,
          MAX(degree) FILTER (WHERE is_active) AS max_degree
        FROM nodes
      `),
    ]);

    const totalActive = parseInt(highDegreeResult.rows[0]?.total_with_degree) || 1;
    // Ignore the "Unresolved" bucket (missing ASN data) when assessing real concentration.
    const topRealIsp = ispResult.rows.find(r => r.isp !== 'Unresolved');
    const topIspPct = parseFloat(topRealIsp?.pct) || 0;

    // Concentration risk: high if top ISP has >40% or medium above 25%
    const concentrationRisk = topIspPct > 40 ? 'high' : topIspPct > 25 ? 'medium' : 'low';

    res.json({
      success: true,
      concentrationRisk,
      subnets: subnetResult.rows.map(r => ({
        subnet: r.subnet + '.x',
        nodeCount: r.node_count,
        clients: r.clients.filter(Boolean),
      })),
      isps: ispResult.rows.map(r => ({
        isp: r.isp,
        nodeCount: r.node_count,
        percentage: parseFloat(r.pct) || 0,
      })),
      highDegreeNodes: parseInt(highDegreeResult.rows[0]?.high_degree_nodes) || 0,
      maxDegree: parseInt(highDegreeResult.rows[0]?.max_degree) || 0,
      timestamp: Date.now(),
    });
  } catch (error) {
    logSafeError('Error fetching concentration data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch concentration data' });
  }
});

registerNetworkAnalyticsRoutes(router);

module.exports = router;
