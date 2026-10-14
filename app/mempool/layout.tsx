import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash Mempool: Pending Transactions | WcashExplorer',
  description: 'Watch pending and unconfirmed W.cash transactions in real time, including transaction size and confirmation status.',
  keywords: ['W.cash mempool', 'W.cash pending transactions', 'W.cash unconfirmed transactions', 'TWC mempool'],
  path: '/mempool',
});

export default function MempoolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
