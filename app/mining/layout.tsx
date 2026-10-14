import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash Mining Statistics & Pool Distribution | WcashExplorer',
  description: 'Explore W.cash Wolf solution-rate observations, block production, mining attribution, fees, and public reward movement.',
  path: '/mining',
  networks: ['mainnet'],
  imageAlt: 'WcashExplorer W.cash mining statistics and pool distribution',
});

export default function MiningLayout({ children }: { children: React.ReactNode }) {
  return children;
}
