// W.cash currently has no authenticated miner-client marker table. Keep the
// collection explicitly typed so the empty initial table remains extensible
// without narrowing `.find()`'s callback parameter to `never`.
const COINBASE_CLIENT_MARKERS: ReadonlyArray<{ hex: string; emoji: string }> = [];

export type CoinbaseClientEmoji = string;

export interface CoinbaseClientInfo {
  emoji: CoinbaseClientEmoji | null;
  name: string | null;
  version: string | null;
}

/**
 * Returns a known client marker embedded in the raw coinbase input.
 * Coinbase markers are self-reported and are not authenticated.
 */
export function getCoinbaseClientEmoji(
  coinbaseHex?: string | null,
): CoinbaseClientEmoji | null {
  if (
    !coinbaseHex
    || coinbaseHex.length % 2 !== 0
    || !/^[0-9a-f]+$/i.test(coinbaseHex)
  ) {
    return null;
  }

  const normalizedHex = coinbaseHex.toLowerCase();
  return COINBASE_CLIENT_MARKERS.find(({ hex }) => normalizedHex.includes(hex))?.emoji ?? null;
}

const VERSION_PATTERN = /\/(Wolf|Wcash)[:\s]?v?(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?)\//i;

function hexToAscii(hex: string): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    result += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.';
  }
  return result;
}

/**
 * Extract client name and version from coinbase hex.
 * Looks for a W.cash Wolf marker in the decoded text. Miner coinbase tags are
 * self-reported and are never treated as authenticated node identity.
 */
export function getCoinbaseClientInfo(
  coinbaseHex?: string | null,
): CoinbaseClientInfo {
  const emoji = getCoinbaseClientEmoji(coinbaseHex);

  if (
    !coinbaseHex
    || coinbaseHex.length % 2 !== 0
    || !/^[0-9a-f]+$/i.test(coinbaseHex)
  ) {
    return { emoji, name: null, version: null };
  }

  const text = hexToAscii(coinbaseHex);
  const match = text.match(VERSION_PATTERN);

  if (match) {
    return { emoji, name: match[1], version: match[2] };
  }

  return { emoji, name: null, version: null };
}
