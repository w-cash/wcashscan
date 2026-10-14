'use strict';

/**
 * W.cash privacy/activity observations.
 *
 * These are public-chain heuristics, never wallet ownership claims. Private
 * Ironwood recipients are not decoded and no exchange/bridge/price data is
 * consulted.
 */

const express = require('express');
const router = express.Router();
const { getWcashProfile } = require('../lib/wcash-profile');
const { logSafeError } = require('../lib/safe-log');

const ZAT_PER_TWC = 100_000_000;
const PERIOD_DAYS = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365, all: null };

function periodDays(value) {
  return Object.prototype.hasOwnProperty.call(PERIOD_DAYS, value) ? PERIOD_DAYS[value] : 30;
}

function sinceSeconds(value) {
  const days = periodDays(value);
  return days == null ? 0 : Math.floor(Date.now() / 1000) - days * 86400;
}

function amountTwc(value) {
  return Number(value || 0) / ZAT_PER_TWC;
}

function riskFor(shield, deshield) {
  const delta = Math.max(0, Number(deshield.block_time) - Number(shield.block_time));
  const amount = Math.max(Number(shield.amount_zat), Number(deshield.amount_zat), 1);
  const amountSimilarity = Math.max(0, 30 - Math.abs(Number(shield.amount_zat) - Number(deshield.amount_zat)) / amount * 30);
  const timeProximity = Math.max(0, 40 - delta / 3600);
  const score = Math.round(Math.min(100, amountSimilarity + timeProximity));
  return {
    score,
    warningLevel: score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW',
    scoreBreakdown: { amountSimilarity: Math.round(amountSimilarity), timeProximity: Math.round(timeProximity), amountRarity: 0 },
    timeDeltaSeconds: delta,
    timeDelta: delta < 3600 ? `${Math.round(delta / 60)} minutes` : `${(delta / 3600).toFixed(1)} hours`,
  };
}

async function riskCandidates(pool, period, limit = 20) {
  const cutoff = sinceSeconds(period);
  const result = await pool.query(`
    SELECT s.txid AS shield_txid, s.block_height AS shield_height, s.block_time AS shield_time,
           s.amount_zat AS shield_amount_zat, d.txid AS deshield_txid,
           d.block_height AS deshield_height, d.block_time AS deshield_time,
           d.amount_zat AS deshield_amount_zat
    FROM shielded_flows s
    JOIN shielded_flows d ON d.pool='ironwood' AND d.flow_type='deshield'
      AND d.txid <> s.txid AND d.block_time >= s.block_time
      AND d.block_time <= s.block_time + 30 * 86400
      AND d.amount_zat BETWEEN GREATEST(1, s.amount_zat - GREATEST(s.amount_zat / 100, 1))
                            AND s.amount_zat + GREATEST(s.amount_zat / 100, 1)
    WHERE s.pool='ironwood' AND s.flow_type='shield' AND s.block_time >= $1
    ORDER BY d.block_time DESC
    LIMIT $2
  `, [cutoff, Math.min(Math.max(Number(limit) || 20, 1), 100) * 5]);
  return result.rows.map((row) => {
    const shield = { amount_zat: row.shield_amount_zat, block_time: row.shield_time };
    const deshield = { amount_zat: row.deshield_amount_zat, block_time: row.deshield_time };
    const risk = riskFor(shield, deshield);
    return {
      shieldTxid: row.shield_txid,
      shieldHeight: Number(row.shield_height),
      shieldTime: Number(row.shield_time),
      shieldAmount: amountTwc(row.shield_amount_zat),
      shieldAmountZat: String(row.shield_amount_zat),
      shieldPool: 'ironwood',
      shieldAddresses: [],
      deshieldTxid: row.deshield_txid,
      deshieldHeight: Number(row.deshield_height),
      deshieldTime: Number(row.deshield_time),
      deshieldAmount: amountTwc(row.deshield_amount_zat),
      deshieldAmountZat: String(row.deshield_amount_zat),
      deshieldPool: 'ironwood',
      deshieldAddresses: [],
      ...risk,
      note: 'Amount/time similarity only; this does not identify a wallet owner or destination.',
    };
  });
}

function filterRisks(rows, riskLevel) {
  return riskLevel && riskLevel !== 'ALL' ? rows.filter((row) => row.warningLevel === riskLevel) : rows;
}

router.get('/api/privacy/risks', async (req, res) => {
  try {
    const period = String(req.query.period || '7d');
    const rows = filterRisks(await riskCandidates(req.app.locals.pool, period, Number(req.query.limit || 20) + Number(req.query.offset || 0)), String(req.query.riskLevel || 'ALL').toUpperCase());
    const offset = Math.max(0, Number(req.query.offset || 0));
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const transactions = rows.slice(offset, offset + limit);
    const riskBreakdown = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const row of rows) riskBreakdown[row.warningLevel] += 1;
    const profile = getWcashProfile();
    res.json({ success: true, network: profile.id, ticker: profile.ticker, coverage: 'heuristic amount/time observations', transactions, stats: { total: rows.length, highRisk: riskBreakdown.HIGH, mediumRisk: riskBreakdown.MEDIUM, lowRisk: riskBreakdown.LOW, avgScore: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0, period }, pagination: { total: rows.length, limit, offset, hasMore: offset + transactions.length < rows.length }, note: 'Public chain heuristic; no private recipient or ownership inference.' });
  } catch (error) {
    logSafeError('W.cash privacy risks failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash privacy observations' });
  }
});

router.get('/api/privacy/linkage-edges', async (req, res) => {
  try {
    const result = await riskCandidates(req.app.locals.pool, String(req.query.period || '7d'), Number(req.query.limit || 20));
    res.json({ success: true, network: 'wcash', ticker: 'TWC', edges: result, pagination: { total: result.length, limit: result.length, offset: 0, hasMore: false }, note: 'Heuristic amount/time similarities only.' });
  } catch (error) {
    logSafeError('W.cash linkage observations failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash linkage observations' });
  }
});

router.get('/api/privacy/common-amounts', async (req, res) => {
  try {
    const period = String(req.query.period || '30d');
    const result = await req.app.locals.pool.query(`
      SELECT amount_zat, COUNT(*)::int AS tx_count
      FROM shielded_flows
      WHERE pool='ironwood' AND flow_type='deshield' AND block_time >= $1 AND amount_zat > 0
      GROUP BY amount_zat ORDER BY tx_count DESC, amount_zat DESC LIMIT $2
    `, [sinceSeconds(period), Math.min(Math.max(Number(req.query.limit || 20), 1), 100)]);
    const total = result.rows.reduce((sum, row) => sum + Number(row.tx_count), 0);
    res.json({ success: true, network: 'wcash', ticker: 'TWC', period, amounts: result.rows.map((row) => ({ amountZat: String(row.amount_zat), amountTwc: amountTwc(row.amount_zat), txCount: Number(row.tx_count), percentage: total ? ((Number(row.tx_count) / total) * 100).toFixed(2) : '0.00', blendingScore: null })) });
  } catch (error) {
    logSafeError('W.cash common amounts failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash amount observations' });
  }
});

router.get('/api/privacy/batch-risks', async (req, res) => {
  try {
    const period = String(req.query.period || '30d');
    const result = await req.app.locals.pool.query(`
      SELECT amount_zat, DATE(TO_TIMESTAMP(block_time)) AS date,
             COUNT(*)::int AS batch_count, ARRAY_AGG(txid ORDER BY block_time) AS txids,
             MIN(block_time) AS first_time, MAX(block_time) AS last_time
      FROM shielded_flows
      WHERE pool='ironwood' AND flow_type='deshield' AND block_time >= $1 AND amount_zat > 0
      GROUP BY amount_zat, date HAVING COUNT(*) >= 2
      ORDER BY batch_count DESC, last_time DESC LIMIT $2
    `, [sinceSeconds(period), Math.min(Math.max(Number(req.query.limit || 20), 1), 100)]);
    const patterns = result.rows.map((row) => ({ clusterHash: null, txids: row.txids || [], batchCount: Number(row.batch_count), perTxAmountZat: String(row.amount_zat), perTxAmountTwc: amountTwc(row.amount_zat), totalAmountZat: (BigInt(row.amount_zat) * BigInt(row.batch_count)).toString(), totalAmountTwc: amountTwc(row.amount_zat) * Number(row.batch_count), firstTime: row.first_time, lastTime: row.last_time, timeSpanHours: (Number(row.last_time) - Number(row.first_time)) / 3600, score: Math.min(100, 30 + Number(row.batch_count) * 5), warningLevel: Number(row.batch_count) >= 5 ? 'HIGH' : 'MEDIUM', note: 'Repeated amount/day grouping; not an ownership claim.' }));
    res.json({ success: true, network: 'wcash', ticker: 'TWC', period, available: true, patterns, pagination: { total: patterns.length, returned: patterns.length, limit: patterns.length, hasMore: false }, stats: { total: patterns.length, highRisk: patterns.filter((row) => row.warningLevel === 'HIGH').length, mediumRisk: patterns.filter((row) => row.warningLevel === 'MEDIUM').length, lowRisk: 0, totalTwcFlagged: patterns.reduce((sum, row) => sum + row.totalAmountTwc, 0), period }, algorithm: { version: 'wcash-1', description: 'Same-amount Ironwood flow/day observations. Private recipients are not inferred.' } });
  } catch (error) {
    logSafeError('W.cash batch observations failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash batch observations' });
  }
});

router.get('/api/privacy/clusters', async (req, res) => {
  // Kept as a compatibility path for clients that used the old name. It is
  // deliberately explicit instead of recursively dispatching this router
  // with a fabricated request object.
  res.json({
    success: true,
    network: 'wcash',
    ticker: 'TWC',
    available: false,
    clusters: [],
    pagination: { total: 0, returned: 0, hasMore: false },
    note: 'W.cashScan exposes amount/day observations, not ownership clusters.',
  });
});

router.get('/api/privacy/graph/:txid', (req, res) => res.json({ success: true, network: 'wcash', ticker: 'TWC', available: false, nodes: [], edges: [], note: 'W.cash private recipients are not decoded into ownership graphs.' }));
router.get('/api/privacy/shield/:txid/batch', (req, res) => res.json({ success: true, network: 'wcash', ticker: 'TWC', available: false, patterns: [], note: 'Use the public amount/day observation endpoint; no private recipient inference is performed.' }));
router.get('/api/privacy/patterns', (req, res) => res.json({ success: true, network: 'wcash', ticker: 'TWC', available: false, patterns: [], note: 'Legacy pattern storage is not used by the W.cash pipeline.' }));

router.get('/api/privacy/fee-lanes', async (req, res) => {
  try {
    const result = await req.app.locals.pool.query(`SELECT COUNT(*)::int AS total FROM transactions WHERE has_ironwood=true AND NOT is_coinbase`);
    res.json({ success: true, network: 'wcash', ticker: 'TWC', available: false, totalIronwoodTransactions: Number(result.rows[0]?.total || 0), unit: 'zatoshi', note: 'W.cashScan does not assume a ZIP-317 fee policy.' });
  } catch (error) {
    logSafeError('W.cash fee observations failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch W.cash fee observations' });
  }
});

router.get('/api/privacy/wallet-fingerprints', (req, res) => res.json({ success: true, network: 'wcash', ticker: 'TWC', available: false, wallets: [], note: 'Wallet identity is not inferable from public W.cash chain data.' }));

module.exports = router;
