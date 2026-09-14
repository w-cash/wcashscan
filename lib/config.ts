import { getConfiguredNetwork, getCurrencyForNetwork, getNetworkLabel, type AppNetwork } from '@/lib/network';

// Auto-detect network based on domain or env variable
function detectNetwork(): AppNetwork {
  // First check explicit env variable
  const configured = getConfiguredNetwork();
  if (configured === 'mainnet' || configured === 'testnet') return configured;
  if (configured === 'crosslink-testnet') return 'crosslink-testnet';

  // Auto-detect from domain (client-side only)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('crosslink')) return 'crosslink-testnet';
    if (hostname.includes('testnet.')) return 'testnet';
    if (hostname.startsWith('mainnet.')) return 'mainnet';
  }

  // Default to testnet for local dev
  return 'testnet';
}

// Network configuration
export const NETWORK = detectNetwork();

export const isMainnet = NETWORK === 'mainnet';
export const isTestnet = NETWORK === 'testnet';
export const isCrosslink = NETWORK === 'crosslink-testnet';

// Currency display
export const CURRENCY = getCurrencyForNetwork(NETWORK);

// Network display
export const NETWORK_LABEL = getNetworkLabel(NETWORK);

// RPC config (server-side only)
export const RPC_CONFIG = {
  url: process.env.WCASH_RPC_URL || process.env.ZCASH_RPC_URL || (isMainnet ? 'http://localhost:8232' : 'http://localhost:18232'),
  cookie: process.env.WCASH_RPC_COOKIE || process.env.ZCASH_RPC_COOKIE || '',
};

// Network colors
export const NETWORK_COLOR = isCrosslink ? 'text-cipher-purple' : isMainnet ? 'text-cipher-yellow' : 'text-gray-400';

// Domain URLs
// Network links are deliberately environment-driven. Until a Wcash mainnet
// host exists, both modes may point at the same local/testnet deployment.
const DEFAULT_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
export const MAINNET_URL = process.env.NEXT_PUBLIC_MAINNET_URL || DEFAULT_SITE_URL;
export const TESTNET_URL = process.env.NEXT_PUBLIC_TESTNET_URL || DEFAULT_SITE_URL;
export const CROSSLINK_URL = process.env.NEXT_PUBLIC_CROSSLINK_URL || TESTNET_URL;

// Crosslink staking constants (from zebra-consensus)
export const STAKING_DAY_PERIOD = 150;
export const STAKING_DAY_WINDOW = 70;
export const STAKING_ACTION_DELAY_BLOCKS = 75;

// Known network upgrade activation heights
export interface NetworkUpgrade {
  name: string;
  zip: string;
  description: string;
  link?: string;
  linkText?: string;
  badge?: string;
}

export const NETWORK_UPGRADES: Record<number, NetworkUpgrade> = {
  3428143: {
    name: 'Ironwood (NU6.3)',
    zip: 'ZIP-258',
    description: 'Activates the Ironwood shielded pool with enhanced cryptographic foundations. WCASH holders can migrate from Orchard to Ironwood via ZIP-318 turnstile transactions.',
    link: '/ironwood',
  },
  3459350: {
    name: 'NU7 Coinholder Vote — Snapshot',
    zip: '',
    description: 'Eligibility snapshot for the NU7 coinholder vote. Spendable Ironwood funds at this height qualify to vote on issuance smoothing, Sprout deprecation, 25-second blocks, and upgrade schedule.',
    link: '/governance/nu7',
    linkText: 'View vote details →',
    badge: 'SNAPSHOT',
  },
  4134000: {
    name: 'Ironwood (NU6.3)',
    zip: 'ZIP-258',
    description: 'Activates the Ironwood shielded pool with enhanced cryptographic foundations. WCASH holders can migrate from Orchard to Ironwood via ZIP-318 turnstile transactions.',
    link: '/ironwood',
  },
};
