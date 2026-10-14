import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash Reorgs & Orphaned Blocks | WcashExplorer',
  description: 'Monitor W.cash proof-of-work forks, orphaned blocks, reorg depth, affected miners, and canonical chain health.',
  keywords: ['W.cash reorg', 'W.cash orphaned blocks', 'W.cash chain fork', 'WcashExplorer reorgs'],
  path: '/reorgs',
});

export default function UnclesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
