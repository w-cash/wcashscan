import profilesDocument from '@/config/wcash-networks.json';

export type WcashDataNetwork = keyof typeof profilesDocument.profiles;

export interface WcashProfile {
  id: WcashDataNetwork;
  displayName: string;
  chain: string;
  rpcChain: string;
  ticker: string;
  genesisHash: string;
  postGenesisBranchId: string;
  targetSpacingSeconds: number;
  halvingInterval: number;
  initialSubsidyZatoshi: string;
  lastNonzeroSubsidyHeight: number;
  scheduledIssuanceZatoshi: string;
  monetaryCeilingZatoshi: string;
  addressPrefixes: {
    p2pkh: number[];
    p2sh: number[];
    unified: string;
    tex: string;
  } | null;
  valuePools: string[];
  capabilities: Record<string, boolean>;
}

const profiles = profilesDocument.profiles as Record<WcashDataNetwork, WcashProfile>;

export const WCASH_TESTNET_PROFILE = profiles['wcash-testnet-v5'];
export const WCASH_REGTEST_PROFILE = profiles['wcash-regtest'];

export function getWcashDataNetwork(): WcashDataNetwork {
  const configured = process.env.NEXT_PUBLIC_DATA_NETWORK || process.env.WCASH_CHAIN;
  if (configured && configured in profiles) return configured as WcashDataNetwork;
  return 'wcash-testnet-v5';
}

export function getWcashProfile(id = getWcashDataNetwork()): WcashProfile {
  return profiles[id] || WCASH_TESTNET_PROFILE;
}

export function getWcashCurrency(): string {
  return getWcashProfile().ticker;
}

export function formatTwcFromZatoshi(value: bigint | string | number): string {
  const zatoshi = typeof value === 'bigint' ? value : BigInt(value);
  const unit = BigInt(100_000_000);
  const negative = zatoshi < BigInt(0);
  const absolute = negative ? -zatoshi : zatoshi;
  const whole = absolute / unit;
  const fraction = (absolute % unit).toString().padStart(8, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
