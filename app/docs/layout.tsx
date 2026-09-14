import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash API Documentation | WcashExplorer',
  description: 'Use WcashExplorer\'s free Wcash API to query blocks, transactions, addresses, shielded pools, privacy analytics, and testnet data.',
  keywords: ['wcash api', 'wcash blockchain api', 'wcash rest api', 'WCASH developer api', 'blockchain api documentation', 'wcash transaction api', 'wcash privacy api', 'wcash supply api', 'wcash shielded pool'],
  path: '/docs',
  networks: ['mainnet'],
});

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
