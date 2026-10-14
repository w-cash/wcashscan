import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash Charts & On-Chain Analytics | WcashExplorer',
  description: 'Explore W.cash charts for Ironwood activity, mining distribution, fees, supply, and network health.',
  keywords: ['W.cash charts', 'W.cash analytics', 'W.cash metrics', 'W.cash mining', 'W.cash privacy stats', 'Ironwood chart'],
  path: '/charts',
  networks: ['mainnet'],
});

export default function ChartsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
