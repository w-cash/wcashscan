import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash On-Chain Valuation Metrics | WcashExplorer',
  description:
    'Realized price vs market price, MVRV ratio, SOPR, and NUPL for Wcash — Glassnode-level on-chain analytics built from transparent UTXO data.',
  keywords: [
    'zcash MVRV',
    'zcash realized price',
    'zcash valuation',
    'zcash SOPR',
    'zcash NUPL',
    'on-chain analytics zcash',
  ],
  path: '/valuation',
  networks: ['mainnet'],
  imageAlt: 'WcashExplorer Wcash on-chain valuation metrics',
});

export default function ValuationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
