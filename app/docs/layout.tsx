import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash API Documentation | WcashExplorer',
  description: 'WcashExplorer API for W.cash blocks, transactions, public addresses, Ironwood activity, mining, and network health.',
  keywords: ['wcash api', 'wcash blockchain api', 'wcash explorer api', 'TWC api', 'blockchain api documentation'],
  path: '/docs',
  networks: ['mainnet'],
});

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
