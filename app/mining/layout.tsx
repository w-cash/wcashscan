import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Mining Statistics & Pool Distribution | WcashExplorer',
  description: 'Explore Wcash hashrate, mining pool distribution, block production, miner rankings, fees, and miner reward flows.',
  path: '/mining',
  networks: ['mainnet'],
  imageAlt: 'WcashExplorer Wcash mining statistics and pool distribution',
});

export default function MiningLayout({ children }: { children: React.ReactNode }) {
  return children;
}
