#!/usr/bin/env node

/** Store exact indexed serialized-byte and supply snapshots for W.cash. */

const { getPool } = require('../lib/db-pool');
const { callWcashRPC } = require('../lib/zebra-rpc');
const { getWcashProfile } = require('../../server/api/lib/wcash-profile');
const { log, loadEnv, withAdvisoryLock } = require('../lib/job-utils');

loadEnv(__dirname);
const pool = getPool({ max: 2 });
const LOCK_ID = 8_392_711;

async function run() {
  const client = await pool.connect();
  try {
    await withAdvisoryLock(client, LOCK_ID, async () => {
      const chain = process.env.WCASH_CHAIN || 'wcash-testnet-v5';
      const profile = getWcashProfile(chain);
      const genesis = await callWcashRPC('getblockhash', [0]);
      if (genesis !== profile.genesisHash) throw new Error('W.cash genesis mismatch');
      const tip = await client.query(`
        SELECT height, block_hash, cumulative_issuance_zat,
               transparent_balance_zat, ironwood_balance_zat
        FROM wcash_block_metrics
        ORDER BY height DESC LIMIT 1
      `);
      const metric = tip.rows[0];
      const height = Number(metric?.height);
      if (!metric || !Number.isSafeInteger(height) || height < 0) throw new Error('No indexed W.cash metric tip');
      const bytes = await client.query(`
        SELECT COALESCE(SUM(serialized_bytes), 0)::bigint AS bytes
        FROM wcash_block_metrics WHERE height <= $1
      `, [height]);
      const chainSupply = BigInt(String(metric.cumulative_issuance_zat));
      const ironwood = BigInt(String(metric.ironwood_balance_zat));
      const transparent = BigInt(String(metric.transparent_balance_zat));
      await client.query(`
        INSERT INTO chain_snapshots
          (snapshot_time, block_height, chain_size_bytes, chain_supply_zat,
           sprout_zat, sapling_zat, orchard_zat, ironwood_zat, transparent_zat,
           source_block_height, source_block_hash)
        VALUES (NOW(), $1, $2, $3, 0, 0, 0, $4, $5, $1, $6)
      `, [height, String(bytes.rows[0]?.bytes || 0), chainSupply.toString(), ironwood.toString(), transparent.toString(), metric.block_hash]);
      log(`W.cash chain snapshot stored at height ${height} (${bytes.rows[0]?.bytes || 0} serialized bytes)`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) run().catch((error) => { log(`ERROR: ${error.message}`); process.exitCode = 1; });

module.exports = { run };
