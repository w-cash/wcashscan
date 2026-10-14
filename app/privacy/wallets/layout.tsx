import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wallet Analysis | WcashExplorer',
  description:
    'W.cash wallet fingerprint analysis is unavailable until native heuristics are validated.',
  path: '/privacy/wallets',
  networks: ['mainnet'],
  keywords: ['W.cash wallet analysis', 'W.cash privacy heuristics'],
});

export default function WalletsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
