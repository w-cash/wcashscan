import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Rich List — Top W.cash Addresses by Balance | WcashExplorer',
  description: 'Explore W.cash transparent addresses ranked by TWC balance and transparent-supply concentration.',
  keywords: ['W.cash rich list', 'TWC top addresses', 'W.cash supply distribution'],
  path: '/rich-list',
  networks: ['mainnet'],
});

export default function RichListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
