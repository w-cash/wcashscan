import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Crosslink Fork Monitor | WcashExplorer',
  description: 'Compare Crosslink test nodes, verify reference block hashes, and monitor active feature-network forks.',
  path: '/fork-monitor',
  index: false,
  networks: ['crosslink-testnet'],
  imageAlt: 'WcashExplorer Wcash Crosslink fork monitor',
});

export default function ForkMonitorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
