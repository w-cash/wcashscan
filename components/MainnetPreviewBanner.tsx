import { MAINNET_USES_TESTNET_DATA } from '@/lib/api-config';
import { isMainnet } from '@/lib/config';

/**
 * Make the temporary mainnet→testnet data routing explicit to visitors.
 * This disappears automatically as soon as NEXT_PUBLIC_MAINNET_API_URL is set.
 */
export function MainnetPreviewBanner() {
  if (!isMainnet || !MAINNET_USES_TESTNET_DATA) return null;

  return (
    <div className="border-b border-cipher-yellow/25 bg-cipher-yellow/10 px-4 py-2 text-center text-[11px] font-mono text-cipher-yellow">
      MAINNET PREVIEW · Showing configured testnet data until a Wcash mainnet API is supplied.
    </div>
  );
}
