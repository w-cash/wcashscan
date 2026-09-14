import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Rich List — Top Wcash Addresses by Balance | WcashExplorer',
  description: 'Explore the top Wcash transparent addresses ranked by balance. See labeled exchanges, mining pools, and supply concentration stats.',
  keywords: ['zcash rich list', 'zcash top addresses', 'zcash whales', 'WCASH balance', 'zcash exchanges', 'zcash supply distribution'],
  path: '/rich-list',
  networks: ['mainnet'],
});

export default function RichListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
