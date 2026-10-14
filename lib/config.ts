import { getConfiguredNetwork } from '@/lib/network';

function detectNetwork(): 'mainnet' | 'testnet' {
  const configured = getConfiguredNetwork();
  if (configured === 'mainnet' || configured === 'testnet') return configured;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('mainnet')) return 'mainnet';
  }
  return 'testnet';
}

export const NETWORK = detectNetwork();
export const isMainnet = NETWORK === 'mainnet';
export const isTestnet = NETWORK === 'testnet';

// Compatibility export while Crosslink-only modules are retired. It is
// permanently false; no Crosslink route or service is registered.
export const isCrosslink = false;

export const CURRENCY = 'TWC';
export const NETWORK_LABEL = isMainnet ? 'W.CASH MAINNET PREVIEW' : 'W.CASH TESTNET';
export const NETWORK_COLOR = isMainnet ? 'text-cipher-yellow' : 'text-gray-400';

export const MAINNET_URL = process.env.NEXT_PUBLIC_MAINNET_URL || 'http://localhost:3002';
export const TESTNET_URL = process.env.NEXT_PUBLIC_TESTNET_URL || 'http://localhost:3000';
// Legacy export only. Crosslink has no destination in WcashScan.
export const CROSSLINK_URL = TESTNET_URL;

export const RPC_CONFIG = {
  url: process.env.WCASH_RPC_URL || 'http://127.0.0.1:38232',
  cookie: process.env.WCASH_RPC_COOKIE || '',
};

export interface NetworkUpgrade {
  name: string;
  zip: string;
  description: string;
  link?: string;
  linkText?: string;
  badge?: string;
}

// W.cash activates Ironwood from the first post-genesis block. Keep the
// legacy lookup shape for block pages until their UI is simplified.
export const NETWORK_UPGRADES: Record<number, NetworkUpgrade> = {
  1: {
    name: 'Ironwood',
    zip: 'Wcash',
    description: 'W.cash Testnet uses the Ironwood value pool from height 1.',
    link: '/ironwood',
  },
};

// Compatibility constants for modules being retired with the Crosslink UI.
// They are not used by the Wcash data pipeline or public API.
export const STAKING_DAY_PERIOD = 150;
export const STAKING_DAY_WINDOW = 70;
export const STAKING_ACTION_DELAY_BLOCKS = 75;
