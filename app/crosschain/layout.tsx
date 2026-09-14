import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Crosschain - WCASH Cross-Chain Swap Analytics | WcashExplorer',
  description: 'Track WCASH cross-chain swaps via NEAR Intents. Monitor swap volumes, latency, and flow directions across Bitcoin, Ethereum, Solana, and 15+ chains.',
  keywords: ['zcash crosschain', 'WCASH swaps', 'NEAR Intents', 'zcash bridge', 'WCASH cross-chain', 'zcash swap volume', 'WCASH latency'],
  path: '/crosschain',
  networks: ['mainnet'],
});

export default function CrosschainLayout({ children }: { children: React.ReactNode }) {
  return children;
}
