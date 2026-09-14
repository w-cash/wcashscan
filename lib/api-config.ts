/**
 * API Configuration
 *
 * Determines which backend to use based on network:
 * - Mainnet: Wcash API configured by NEXT_PUBLIC_MAINNET_API_URL
 * - Testnet: Wcash API configured by NEXT_PUBLIC_TESTNET_API_URL
 * - Crosslink Testnet: PostgreSQL API + crosslink finality enrichment
 *
 * Network is auto-detected from the domain:
 * - a configured mainnet host → mainnet
 * - a configured testnet host → testnet
 * - localhost → testnet (default)
 */
import {
  getConfiguredNetwork,
  normalizeApiBaseUrl,
  type AppNetwork,
} from '@/lib/network';

export type Network = AppNetwork;

/**
 * Detect network from domain (client-side safe)
 */
function detectNetwork(): Network {
  // Explicit env override wins on both server and client (NEXT_PUBLIC_* is
  // inlined into the client bundle by Next.js). This is how a developer runs
  // the crosslink build against localhost.
  const configured = getConfiguredNetwork();
  if (configured) return configured;

  // Server-side without env fallback → testnet.
  if (typeof window === 'undefined') return 'testnet';

  // Client-side: detect from hostname.
  const hostname = window.location.hostname;
  if (hostname.includes('mainnet')) return 'mainnet';
  if (hostname.includes('crosslink')) return 'crosslink-testnet';
  return 'testnet';
}

export const NETWORK = detectNetwork();

const TESTNET_API_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_TESTNET_API_URL
    || process.env.NEXT_PUBLIC_API_URL
    || 'http://localhost:3001',
);

// Mainnet intentionally falls back to the testnet API until a real Wcash
// mainnet service is supplied. Replacing one environment variable is enough
// to switch the production deployment later; no UI code needs to change.
const MAINNET_API_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_MAINNET_API_URL || TESTNET_API_URL,
);

const DEFAULT_API_URLS: Record<Network, string> = {
  'mainnet': MAINNET_API_URL,
  'testnet': TESTNET_API_URL,
  'crosslink-testnet': normalizeApiBaseUrl(
    process.env.NEXT_PUBLIC_CROSSLINK_API_URL || TESTNET_API_URL,
  ),
};

export const MAINNET_USES_TESTNET_DATA = !process.env.NEXT_PUBLIC_MAINNET_API_URL;

export function getApiUrlForNetwork(network: Network): string {
  const networkSpecificUrl = network === 'mainnet'
    ? process.env.NEXT_PUBLIC_MAINNET_API_URL
    : network === 'testnet'
      ? process.env.NEXT_PUBLIC_TESTNET_API_URL
      : process.env.NEXT_PUBLIC_CROSSLINK_API_URL;
  const configuredUrl = networkSpecificUrl
    || (typeof window === 'undefined'
      ? process.env.WCASHEXPLORER_API_URL
        || process.env.CIPHERSCAN_API_URL
        || process.env.NEXT_PUBLIC_API_URL
      : process.env.NEXT_PUBLIC_API_URL);

  return normalizeApiBaseUrl(configuredUrl || DEFAULT_API_URLS[network]);
}

export const API_CONFIG = {
  // Direct RPC for fallback - server-side only
  RPC_URL: process.env.WCASH_RPC_URL || process.env.ZCASH_RPC_URL || 'http://localhost:18232',
  RPC_COOKIE: process.env.WCASH_RPC_COOKIE || process.env.ZCASH_RPC_COOKIE,

  // Crosslink zebra-crosslink RPC (only set when running against a crosslink node)
  CROSSLINK_RPC_URL: process.env.CROSSLINK_RPC_URL || null,
  CROSSLINK_RPC_COOKIE: process.env.CROSSLINK_RPC_COOKIE || null,

};

/**
 * Get the appropriate API URL based on network (client-side safe)
 */
export function getApiUrl(): string {
  return getApiUrlForNetwork(NETWORK);
}

/**
 * Whether crosslink finality data is available (server-side only)
 */
export function hasCrosslinkRpc(): boolean {
  return !!API_CONFIG.CROSSLINK_RPC_URL;
}

/**
 * Whether this deployment targets a crosslink network (client-side safe)
 */
export function isCrosslinkNetwork(): boolean {
  return NETWORK === 'crosslink-testnet';
}
