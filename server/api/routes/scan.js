/**
 * Wallet scanning compatibility routes.
 *
 * The public WcashExplorer scanner is read-only. It does not accept viewing
 * keys, scan arbitrary wallet ranges, or use a legacy Lightwalletd parser.
 * These paths remain closed so old clients receive an explicit response.
 */

const express = require('express');
const router = express.Router();

function walletScanDisabled(res, feature) {
  return res.status(403).json({
    success: false,
    code: 'WALLET_SCAN_DISABLED',
    feature,
    error: 'Wallet scanning is disabled for this W.cash explorer deployment',
    available: false,
  });
}

router.post('/api/scan/orchard', (_req, res) => walletScanDisabled(res, 'legacy-wallet-scan'));
router.post('/api/lightwalletd/scan', (_req, res) => walletScanDisabled(res, 'lightwalletd-wallet-scan'));

module.exports = router;
