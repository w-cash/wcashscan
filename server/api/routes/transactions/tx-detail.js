/**
 * W.cash transaction detail routes.
 *
 * This module deliberately reads only the WcashScan index tables. There is no
 * bridge, price, Crosslink, governance, or wallet-writing lookup in the
 * transaction path. Those data sources cannot be inferred from W.cash
 * consensus and must not leak into an explorer response.
 */

const express = require('express');
const router = express.Router();
const { validate } = require('../../validation');
const { decodeCoinbaseText } = require('../../coinbase-data');
const { deps } = require('./_helpers');
const { logSafeError } = require('../../lib/safe-log');
const { getWcashProfile } = require('../../lib/wcash-profile');

function isTxid(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
}

function zatToTwc(value) {
  return value == null ? null : Number(value) / 100_000_000;
}

function statusFor(row) {
  if (row.is_canonical) return 'confirmed';
  return row.block_hash ? 'stale' : 'unknown';
}

function confirmationsFor(row, tipHeight) {
  const height = Number(row.block_height);
  if (!row.is_canonical || !Number.isSafeInteger(height) || tipHeight < height) return 0;
  return tipHeight - height + 1;
}

function cacheControlFor(status, confirmations) {
  if (status === 'unknown') return 'no-store';
  if (status === 'stale') return 'public, s-maxage=30, stale-while-revalidate=300';
  if (confirmations >= 100) return 'public, s-maxage=3600, stale-while-revalidate=86400';
  return 'public, s-maxage=15, stale-while-revalidate=120';
}

function publicTransaction(row, inputs, outputs, tipHeight) {
  const profile = getWcashProfile();
  const status = statusFor(row);
  const confirmations = confirmationsFor(row, tipHeight);
  const blockTime = Number(row.block_time) || 0;
  const hasIronwood = Boolean(row.has_ironwood);
  const hasSapling = Boolean(row.has_sapling);
  const hasOrchard = Boolean(row.has_orchard);

  return {
    dataNetwork: profile.id,
    ticker: profile.ticker,
    txid: row.txid,
    blockHeight: Number(row.block_height) || 0,
    blockHash: row.block_hash,
    blockTime,
    timestamp: blockTime,
    confirmations,
    isCanonical: Boolean(row.is_canonical),
    status,
    size: Number(row.size) || 0,
    version: Number(row.version) || 0,
    locktime: Number(row.locktime) || 0,
    expiryHeight: row.expiry_height == null ? null : Number(row.expiry_height),
    valueBalance: zatToTwc(row.value_balance),
    valueBalanceZat: row.value_balance == null ? null : String(row.value_balance),
    valueBalanceSapling: zatToTwc(row.value_balance_sapling),
    valueBalanceSaplingZat: row.value_balance_sapling == null ? null : String(row.value_balance_sapling),
    valueBalanceOrchard: zatToTwc(row.value_balance_orchard),
    valueBalanceOrchardZat: row.value_balance_orchard == null ? null : String(row.value_balance_orchard),
    valueBalanceIronwood: zatToTwc(row.value_balance_ironwood),
    valueBalanceIronwoodZat: row.value_balance_ironwood == null ? null : String(row.value_balance_ironwood),
    fee: zatToTwc(row.fee),
    feeZat: row.fee == null ? null : String(row.fee),
    totalInput: zatToTwc(row.total_input),
    totalInputZat: row.total_input == null ? null : String(row.total_input),
    totalOutput: zatToTwc(row.total_output),
    totalOutputZat: row.total_output == null ? null : String(row.total_output),
    isCoinbase: Boolean(row.is_coinbase),
    hasSapling,
    hasOrchard,
    hasIronwood,
    hasSprout: Boolean(row.has_sprout),
    hasShielded: hasSapling || hasOrchard || hasIronwood,
    orchardActions: Number(row.orchard_actions) || 0,
    ironwoodActions: Number(row.ironwood_actions) || 0,
    saplingSpendCount: Number(row.sapling_spend_count) || 0,
    saplingOutputCount: Number(row.sapling_output_count) || 0,
    inputs,
    outputs,
    inputCount: inputs.length,
    outputCount: outputs.length,
    coinbaseHex: row.block_coinbase_hex || null,
    coinbaseText: row.block_coinbase_hex ? decodeCoinbaseText(row.block_coinbase_hex) : null,
    // Explicitly empty compatibility fields make the disabled capability
    // visible to old clients without returning data from a foreign system.
    bridge: null,
    bridges: [],
    zip318: null,
    stakingAction: null,
  };
}

router.get('/api/seo/tx/:txid', validate('txById'), async (req, res) => {
  try {
    const { txid } = req.params;
    if (!isTxid(txid)) return res.status(400).json({ error: 'Invalid transaction ID' });

    const result = await deps.pool.query(
      `WITH chain AS (SELECT MAX(height) AS max_height FROM blocks)
       SELECT t.txid, t.block_height, t.block_hash, t.block_time, t.is_coinbase,
              t.has_sapling, t.has_orchard, t.has_ironwood, t.orchard_actions,
              t.sapling_spend_count, t.sapling_output_count, t.fee,
              (b.hash IS NOT NULL) AS is_canonical,
              CASE WHEN b.hash IS NOT NULL AND chain.max_height >= t.block_height
                   THEN chain.max_height - t.block_height + 1 ELSE 0 END AS confirmations
       FROM transactions t CROSS JOIN chain
       LEFT JOIN blocks b ON b.height = t.block_height AND b.hash = t.block_hash
       WHERE t.txid = $1`,
      [txid],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    const tx = result.rows[0];
    const profile = getWcashProfile();
    const canonical = Boolean(tx.is_canonical);
    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    return res.json({
      dataNetwork: profile.id,
      ticker: profile.ticker,
      txid: tx.txid,
      blockHeight: Number(tx.block_height) || 0,
      blockHash: tx.block_hash,
      blockTime: Number(tx.block_time) || 0,
      confirmations: canonical ? Number(tx.confirmations) || 0 : 0,
      isCanonical: canonical,
      status: canonical ? 'confirmed' : (tx.block_hash ? 'stale' : 'unknown'),
      isCoinbase: Boolean(tx.is_coinbase),
      hasSapling: Boolean(tx.has_sapling),
      hasOrchard: Boolean(tx.has_orchard),
      hasIronwood: Boolean(tx.has_ironwood),
      hasShielded: Boolean(tx.has_sapling || tx.has_orchard || tx.has_ironwood),
      orchardActions: Number(tx.orchard_actions) || 0,
      saplingSpendCount: Number(tx.sapling_spend_count) || 0,
      saplingOutputCount: Number(tx.sapling_output_count) || 0,
      fee: zatToTwc(tx.fee) || 0,
    });
  } catch (error) {
    logSafeError('Error fetching W.cash transaction metadata:', error);
    return res.status(500).json({ error: 'Failed to fetch transaction metadata' });
  }
});

router.get('/api/tx/:txid', validate('txById'), async (req, res) => {
  try {
    const { txid } = req.params;
    if (!isTxid(txid)) return res.status(400).json({ error: 'Invalid transaction ID' });

    const [txResult, inputsResult, outputsResult, tipResult] = await Promise.all([
      deps.pool.query(
        `SELECT t.txid, t.block_height, t.block_hash, t.block_time, t.size,
                t.version, t.locktime, t.vin_count, t.vout_count,
                t.value_balance, t.value_balance_sapling, t.value_balance_orchard,
                t.value_balance_ironwood, t.has_sapling, t.has_orchard,
                t.has_ironwood, t.has_sprout, t.orchard_actions, t.ironwood_actions,
                t.sapling_spend_count, t.sapling_output_count, t.fee,
                t.total_input, t.total_output, t.is_coinbase, t.expiry_height,
                b.coinbase_hex AS block_coinbase_hex,
                (b.hash IS NOT NULL) AS is_canonical
         FROM transactions t
         LEFT JOIN blocks b ON b.height = t.block_height AND b.hash = t.block_hash
         WHERE t.txid = $1`,
        [txid],
      ),
      deps.pool.query(
        `SELECT prev_txid, prev_vout, address, value, vout_index
         FROM transaction_inputs WHERE txid = $1 ORDER BY vout_index`,
        [txid],
      ),
      deps.pool.query(
        `SELECT address, value, vout_index, spent
         FROM transaction_outputs WHERE txid = $1 ORDER BY vout_index`,
        [txid],
      ),
      deps.pool.query('SELECT MAX(height) AS max_height FROM blocks'),
    ]);

    if (txResult.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    const tx = txResult.rows[0];
    const tipHeight = Number(tipResult.rows[0]?.max_height) || 0;
    const status = statusFor(tx);
    const payload = publicTransaction(tx, inputsResult.rows, outputsResult.rows, tipHeight);
    res.set('Cache-Control', cacheControlFor(status, payload.confirmations));
    return res.json(payload);
  } catch (error) {
    logSafeError('Error fetching W.cash transaction:', error);
    return res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

module.exports = router;
