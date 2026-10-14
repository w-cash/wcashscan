/**
 * Compatibility transaction-reader routes.
 *
 * WcashExplorer does not expose the inherited Orchard/Sapling reader or
 * heuristic linkability endpoint. Public transaction data is served by the
 * W.cash-native routes in tx-lists.js and tx-detail.js.
 */

const express = require('express');
const router = express.Router();

function unavailable(res, feature) {
  return res.status(404).json({
    success: false,
    code: 'WCASH_FEATURE_UNAVAILABLE',
    feature,
    error: 'This W.cash scanner feature is not enabled',
    available: false,
  });
}

// Kept as a closed compatibility path so stale clients cannot silently query
// legacy shielded-pool columns.
router.get('/api/tx/shielded', (_req, res) => unavailable(res, 'legacy-shielded-reader'));
router.get('/api/tx/:txid/linkability', (_req, res) => unavailable(res, 'transaction-linkability-heuristics'));

module.exports = router;
