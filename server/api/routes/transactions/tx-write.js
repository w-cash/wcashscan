/**
 * Transaction write routes — broadcast and submit.
 */

const express = require('express');
const router = express.Router();
const { validate } = require('../../validation');
const { deps } = require('./_helpers');
const { logSafeError } = require('../../lib/safe-log');
const { getWcashProfile } = require('../../lib/wcash-profile');

/**
 * POST /api/tx/broadcast
 * Broadcast a raw signed transaction to the W.cash network
 * Body: { "rawTx": "hex-encoded-raw-transaction" }
 *
 * Note: This only accepts a raw W.cash transaction hex (already signed).
 * No private keys or viewing keys are involved - the TX is fully
 * constructed and signed client-side before being sent here.
 */
router.post('/api/tx/broadcast', validate('txBroadcast'), async (req, res) => {
  let enabled = false;
  try {
    enabled = process.env.WCASH_ENABLE_BROADCAST === 'true'
      && getWcashProfile().capabilities.broadcast === true;
  } catch {
    enabled = false;
  }
  if (!enabled) {
    return res.status(403).json({
      success: false,
      code: 'BROADCAST_DISABLED',
      error: 'Transaction broadcast is disabled for this W.cash explorer deployment',
    });
  }

  try {
    const { rawTx } = req.body;

    if (!rawTx || typeof rawTx !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid rawTx parameter. Provide a hex-encoded signed transaction.',
      });
    }

    // Basic hex validation
    if (!/^[0-9a-fA-F]+$/.test(rawTx)) {
      return res.status(400).json({
        success: false,
        error: 'rawTx must be a valid hex string.',
      });
    }

    console.log(`📡 [BROADCAST] Broadcasting transaction (${rawTx.length / 2} bytes)...`);

    const txid = await deps.callZebraRPC('sendrawtransaction', [rawTx]);

    console.log('✅ [BROADCAST] Transaction broadcast successfully');

    res.json({
      success: true,
      txid,
    });
  } catch (error) {
    logSafeError('❌ [BROADCAST] Error:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to broadcast transaction',
    });
  }
});

module.exports = router;
