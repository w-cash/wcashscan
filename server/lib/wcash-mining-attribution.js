/**
 * W.cash mining attribution.
 *
 * A payout address is not a mining-pool identity by itself. The explorer
 * therefore ships with no inherited Zcash address list. Operators may add
 * verified W.cash addresses and/or coinbase tag patterns through the private
 * WCASH_MINING_POOL_MAP and WCASH_MINING_POOL_TAGS environment variables.
 * Every other miner remains "Unknown" in the denominator.
 */

function readJson(name, fallback) {
  if (!process.env[name]) return fallback;
  try {
    const value = JSON.parse(process.env[name]);
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    throw new Error(`${name} must contain valid JSON`);
  }
}

const configuredAddresses = readJson('WCASH_MINING_POOL_MAP', {});
const configuredTags = readJson('WCASH_MINING_POOL_TAGS', {});

const POOL_BY_ADDRESS = Object.fromEntries(
  Object.entries(configuredAddresses)
    .filter(([address, value]) => typeof address === 'string' && value)
    .map(([address, value]) => [
      address,
      typeof value === 'string' ? { name: value, url: null, region: null } : {
        name: value.name || 'Unknown',
        url: value.url || null,
        region: value.region || null,
        verified: value.verified === true,
      },
    ]),
);

const POOL_BY_TAG = Object.fromEntries(
  Object.entries(configuredTags)
    .filter(([tag, value]) => typeof tag === 'string' && typeof value === 'string')
    .map(([tag, name]) => [tag, { name, url: null, region: null, attribution: 'operator-config' }]),
);

const TAG_PATTERNS = Object.keys(POOL_BY_TAG).map((tag) => ({
  tag,
  hex: Buffer.from(tag, 'utf8').toString('hex'),
}));

function getPoolTag(coinbaseHex) {
  if (typeof coinbaseHex !== 'string') return null;
  const value = coinbaseHex.toLowerCase();
  return TAG_PATTERNS.find(({ hex }) => value.includes(hex))?.tag || null;
}

function getPoolTagSql(column = 'coinbase_hex') {
  if (!/^[a-z_]+(?:\.[a-z_]+)?$/.test(column)) {
    throw new Error('Invalid coinbase SQL column');
  }
  if (TAG_PATTERNS.length === 0) return 'NULL';
  const clauses = TAG_PATTERNS.map(({ tag, hex }) =>
    `WHEN ${column} ILIKE '%${hex}%' THEN '${tag.replace(/'/g, "''")}'`,
  );
  return `(CASE ${clauses.join(' ')} ELSE NULL END)`;
}

function getPoolName(address, coinbaseHex) {
  return POOL_BY_ADDRESS[address]?.name || POOL_BY_TAG[getPoolTag(coinbaseHex)]?.name || null;
}

function getPoolInfo(address, coinbaseHex) {
  return POOL_BY_ADDRESS[address] || POOL_BY_TAG[getPoolTag(coinbaseHex)] || null;
}

module.exports = {
  POOL_BY_ADDRESS,
  POOL_BY_TAG,
  getPoolName,
  getPoolInfo,
  getPoolTag,
  getPoolTagSql,
};
