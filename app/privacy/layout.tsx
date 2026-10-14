import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash Ironwood Activity | WcashExplorer',
  description: 'Track W.cash Testnet Ironwood activity, transparent balances, shielded flow observations, and indexed public metrics.',
  keywords: ['W.cash activity', 'WcashExplorer', 'Ironwood', 'TWC explorer'],
  path: '/privacy',
  networks: ['mainnet'],
});

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
