import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Mempool: Pending Transactions | WcashExplorer',
  description: 'Watch pending and unconfirmed Wcash transactions in real time, including transaction size, fee rate, and confirmation status.',
  keywords: ['zcash mempool', 'zcash pending transactions', 'zcash unconfirmed transactions', 'WCASH mempool', 'zcash transaction pool', 'zcash fee rate'],
  path: '/mempool',
});

export default function MempoolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
