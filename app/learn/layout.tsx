import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Learn W.cash | WcashExplorer',
  description: 'Learn how W.cash chain data, transparent outputs, Ironwood activity, Wolf RPC, and the WcashExplorer indexer fit together.',
  keywords: ['learn wcash', 'wcash guide', 'TWC', 'wcash explorer', 'Ironwood'],
  path: '/learn',
  networks: ['mainnet'],
});

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
