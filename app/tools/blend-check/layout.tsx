import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Blend Check | WcashExplorer',
  description: 'See how common a WCASH amount is on the Wcash blockchain. Use popular amounts to blend in with the crowd.',
  keywords: ['zcash', 'privacy', 'blend', 'amount', 'shielded', 'transaction', 'common'],
  path: '/tools/blend-check',
  networks: ['mainnet'],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
