import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Latest Wcash Blocks - Block Explorer | WcashExplorer',
  description: 'Browse the latest Wcash blocks with transaction counts, sizes, mining rewards, and timestamps. Real-time block explorer data.',
  keywords: ['zcash blocks', 'zcash block explorer', 'zcash latest blocks', 'WCASH blocks', 'zcash block height'],
  path: '/blocks',
});

export default function BlocksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
