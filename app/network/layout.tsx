import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash Network Stats & Node Map | WcashExplorer',
  description: 'Track W.cash network health with live node locations, hashrate, difficulty, peer counts, and blockchain statistics.',
  keywords: ['W.cash network stats', 'W.cash node map', 'W.cash hashrate', 'W.cash peers', 'W.cash nodes', 'TWC network'],
  path: '/network',
});

export default function NetworkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
