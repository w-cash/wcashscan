import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Amount Observations | WcashExplorer',
  description: 'WcashExplorer does not claim amount blending or wallet ownership.',
  keywords: ['W.cash', 'TWC', 'public flow observations'],
  path: '/tools/blend-check',
  networks: ['mainnet'],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
