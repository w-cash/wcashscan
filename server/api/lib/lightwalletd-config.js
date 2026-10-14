'use strict';

function getLightwalletdGrpcAddress() {
  return process.env.WCASH_LIGHTWALLETD_GRPC_URL || '127.0.0.1:9067';
}

module.exports = { getLightwalletdGrpcAddress };
