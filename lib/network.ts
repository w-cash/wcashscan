/**
 * Frontend network selection.
 *
 * This is deliberately separate from the actual data profile. During the
 * Wcash preview period both selected origins use the same W.cash Testnet data
 * and TWC currency; `mainnet` is a UI destination, not a claim of live WEC.
 */
// The third value remains type-compatible for retired legacy modules during
// the cleanup. It is no longer accepted from configuration and has no public
// URL or data source.
export type AppNetwork = 'mainnet' | 'testnet' | 'crosslink-testnet';

export function getConfiguredNetwork(): AppNetwork | undefined {
  const configured = process.env.NEXT_PUBLIC_NETWORK;
  if (configured === 'mainnet' || configured === 'testnet') return configured;
  return undefined;
}

export function getNetworkLabel(network: AppNetwork = getConfiguredNetwork() || 'testnet'): string {
  return network === 'mainnet' ? 'W.CASH MAINNET PREVIEW' : 'W.CASH TESTNET';
}

export function getDataNetworkLabel(): string {
  return 'W.CASH TESTNET';
}

/** Public API helpers append `/api/...`; keep configured values origin-only. */
export function normalizeApiBaseUrl(value: string): string {
  const withoutTrailingSlashes = value.trim().replace(/\/+$/, '');
  return withoutTrailingSlashes.replace(/\/api$/i, '');
}
