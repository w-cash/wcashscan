import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Crosslink Dual-Chain Monitor | WcashExplorer',
  description: 'Monitor Crosslink proof-of-work blocks and BFT finality votes together on the WcashExplorer feature-network explorer.',
  path: '/chain',
  index: false,
  networks: ['crosslink-testnet'],
  imageAlt: 'WcashExplorer Wcash Crosslink dual-chain monitor',
});

export default function ChainLayout({ children }: { children: React.ReactNode }) {
  return children;
}
