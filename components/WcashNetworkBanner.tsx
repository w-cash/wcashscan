import { isMainnet } from '@/lib/config';

/**
 * Makes the actual data identity impossible to miss when the selected
 * Mainnet-origin preview is sharing the Testnet database.
 */
export function WcashNetworkBanner() {
  return (
    <div
      role="status"
      className={`border-b px-4 py-2 text-center text-[11px] font-mono tracking-wide ${
        isMainnet
          ? 'border-cipher-yellow/30 bg-cipher-yellow/10 text-cipher-yellow'
          : 'border-cipher-border bg-cipher-surface text-muted'
      }`}
    >
      {isMainnet
        ? 'Mainnet preview — showing W.cash Testnet data. TWC has no monetary value.'
        : 'W.cash Testnet · TWC'}
    </div>
  );
}
