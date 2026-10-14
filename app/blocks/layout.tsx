import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Latest W.cash Blocks | WcashExplorer',
  description: 'Browse W.cash Testnet blocks with transaction counts, sizes, mining rewards, and timestamps.',
  keywords: ['W.cash blocks', 'WcashExplorer', 'TWC blocks', 'W.cash block height'],
  path: '/blocks',
});

export default function BlocksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
