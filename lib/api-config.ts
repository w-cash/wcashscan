/** Build-time API routing for WcashScan. */
import {
  getConfiguredNetwork,
  normalizeApiBaseUrl,
  type AppNetwork,
} from '@/lib/network';

export type Network = AppNetwork;

function detectNetwork(): Network {
  const configured = getConfiguredNetwork();
  if (configured) return configured;
  if (typeof window === 'undefined') return 'testnet';
  return window.location.hostname.includes('mainnet') ? 'mainnet' : 'testnet';
}

export const NETWORK = detectNetwork();

const TESTNET_API_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_TESTNET_API_URL
    || process.env.NEXT_PUBLIC_API_URL
    || 'http://localhost:3001',
);

// Mainnet intentionally shares Testnet data until a real Wcash mainnet
// profile and API are supplied. Switching later is an environment-only URL
// change; no dashboard code should need to change.
const MAINNET_API_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_MAINNET_API_URL || TESTNET_API_URL,
);

const DEFAULT_API_URLS: Record<Network, string> = {
  mainnet: MAINNET_API_URL,
  testnet: TESTNET_API_URL,
  'crosslink-testnet': TESTNET_API_URL,
};

export const MAINNET_USES_TESTNET_DATA = !process.env.NEXT_PUBLIC_MAINNET_API_URL;

export function getApiUrlForNetwork(network: Network): string {
  const networkSpecificUrl = network === 'mainnet'
    ? process.env.NEXT_PUBLIC_MAINNET_API_URL
    : process.env.NEXT_PUBLIC_TESTNET_API_URL;
  const configuredUrl = networkSpecificUrl
    || (typeof window === 'undefined'
      ? process.env.WCASHEXPLORER_API_URL || process.env.NEXT_PUBLIC_API_URL
      : process.env.NEXT_PUBLIC_API_URL);
  return normalizeApiBaseUrl(configuredUrl || DEFAULT_API_URLS[network]);
}

export const API_CONFIG = {
  RPC_URL: process.env.WCASH_RPC_URL || 'http://127.0.0.1:38232',
  RPC_COOKIE: process.env.WCASH_RPC_COOKIE,
  CROSSLINK_RPC_URL: null,
  CROSSLINK_RPC_COOKIE: null,
};

export function getApiUrl(): string {
  return getApiUrlForNetwork(NETWORK);
}

// Compatibility exports for modules removed in the next cleanup pass.
export function hasCrosslinkRpc(): boolean { return false; }
export function isCrosslinkNetwork(): boolean { return false; }
