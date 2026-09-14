export type AppNetwork = 'mainnet' | 'testnet' | 'crosslink-testnet';

export function getCurrencyForNetwork(network: AppNetwork): string {
  if (network === 'mainnet') {
    return process.env.NEXT_PUBLIC_MAINNET_CURRENCY || 'WCASH';
  }
  if (network === 'crosslink-testnet') {
    return process.env.NEXT_PUBLIC_CROSSLINK_CURRENCY || 'TWC';
  }
  return process.env.NEXT_PUBLIC_TESTNET_CURRENCY || 'TWC';
}

/**
 * Normalize the build-time network selector in one place so metadata, API
 * routing, and visible network labels cannot disagree.
 */
export function getConfiguredNetwork(): AppNetwork | undefined {
  const configured = process.env.NEXT_PUBLIC_NETWORK;

  if (configured === 'mainnet' || configured === 'testnet') {
    return configured;
  }

  // `crosslink` is a legacy deployment value. New configuration should use
  // the explicit `crosslink-testnet` name documented in DEPLOYMENT.md.
  if (configured === 'crosslink' || configured === 'crosslink-testnet') {
    return 'crosslink-testnet';
  }

  return undefined;
}

/**
 * The one visible "which network am I looking at" label — used by every
 * page-level network badge (tx detail, block detail, …) so they can't drift
 * into different wording for the same three states.
 */
export function getNetworkLabel(network: AppNetwork = getConfiguredNetwork() || 'testnet'): string {
  if (network === 'testnet') return `WCASH TESTNET (${getCurrencyForNetwork('testnet')})`;
  if (network === 'crosslink-testnet') return `WCASH CROSSLINK TESTNET (${getCurrencyForNetwork('crosslink-testnet')})`;
  return `WCASH MAINNET (${getCurrencyForNetwork('mainnet')})`;
}

/**
 * Public API helpers append their own `/api/...` paths. Accept the legacy
 * Crosslink setting that ended in `/api`, but normalize every configured base
 * to an origin-style URL so callers cannot accidentally request `/api/api/...`.
 */
export function normalizeApiBaseUrl(value: string): string {
  const withoutTrailingSlashes = value.trim().replace(/\/+$/, '');
  return withoutTrailingSlashes.replace(/\/api$/i, '');
}
