'use strict';

const DEFAULT_LIGHTWALLETD_HOST = '127.0.0.1';
const DEFAULT_LIGHTWALLETD_PORT = '9067';

/**
 * Resolve the lightwalletd-compatible gRPC target once for every scanner path.
 * Keep the legacy localhost default, but allow Wcash's embedded service or a
 * deployed lightwalletd instance to use its actual host and port.
 */
function getLightwalletdAddress() {
  const explicit = process.env.LIGHTWALLETD_ADDRESS || process.env.LIGHTWALLETD_URL;
  if (explicit) return explicit.trim().replace(/^(?:grpc|https?):\/\//i, '').replace(/\/+$/, '');

  const host = process.env.LIGHTWALLETD_HOST || DEFAULT_LIGHTWALLETD_HOST;
  const port = process.env.LIGHTWALLETD_PORT || DEFAULT_LIGHTWALLETD_PORT;
  return `${host}:${port}`;
}

module.exports = { getLightwalletdAddress };
