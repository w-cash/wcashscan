import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'W.cash Ironwood Pool | WcashExplorer',
  description: 'Inspect aggregate W.cash Ironwood pool balances and public indexed activity from Wolf and WcashExplorer.',
  keywords: ['W.cash Ironwood', 'TWC shielded pool', 'WcashExplorer Ironwood'],
  path: '/ironwood',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
