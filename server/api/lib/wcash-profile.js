const path = require('path');

const profilesDocument = require(path.resolve(__dirname, '../../../config/wcash-networks.json'));
const profiles = profilesDocument.profiles;

const DEFAULT_DATA_NETWORK = 'wcash-testnet-v5';

// Human-readable leading characters for the W.cash Base58Check namespaces.
// The consensus version bytes remain the source of truth in the profile; this
// lookup is only for SQL classification of already-decoded stored addresses.
const BASE58_PREFIXES = {
  'wcash-testnet-v5': { p2pkh: 'WT', p2sh: 'WU' },
  'wcash-regtest': { p2pkh: 'WR', p2sh: 'WS' },
  'wcash-mainnet': { p2pkh: 'W1', p2sh: 'W3' },
};

function getConfiguredDataNetwork() {
  const configured = process.env.WCASH_CHAIN || process.env.NEXT_PUBLIC_DATA_NETWORK || DEFAULT_DATA_NETWORK;
  if (!profiles[configured]) {
    throw new Error(`Unknown Wcash data network profile: ${configured}`);
  }
  return configured;
}

function getWcashProfile(id = getConfiguredDataNetwork()) {
  const profile = profiles[id];
  if (!profile) throw new Error(`Unknown Wcash data network profile: ${id}`);
  return profile;
}

function getWcashBase58Prefixes(id = getConfiguredDataNetwork()) {
  const prefixes = BASE58_PREFIXES[id];
  if (!prefixes) throw new Error(`No Wcash Base58 prefixes configured for ${id}`);
  return prefixes;
}

function getPublicWcashConfig({ indexed = null, node = null, databaseIdentity = null, status = 'unavailable' } = {}) {
  const profile = getWcashProfile();
  return {
    dataNetwork: profile.id,
    chain: profile.chain,
    ticker: profile.ticker,
    genesisHash: profile.genesisHash,
    postGenesisBranchId: profile.postGenesisBranchId,
    targetSpacingSeconds: profile.targetSpacingSeconds,
    halvingInterval: profile.halvingInterval,
    capabilities: profile.capabilities,
    valuePools: profile.valuePools,
    status,
    indexed,
    node,
    databaseIdentity,
  };
}

function assertGenesisHash(actual, profile = getWcashProfile()) {
  if (String(actual || '').toLowerCase() !== profile.genesisHash.toLowerCase()) {
    throw new Error(`Wcash genesis mismatch for ${profile.id}`);
  }
}

module.exports = {
  DEFAULT_DATA_NETWORK,
  getConfiguredDataNetwork,
  getWcashProfile,
  getWcashBase58Prefixes,
  getPublicWcashConfig,
  assertGenesisHash,
};
