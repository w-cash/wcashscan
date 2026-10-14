import { buildPageMetadata } from '@/lib/seo';
import { WcashUnavailable } from '@/components/WcashUnavailable';

export const metadata = buildPageMetadata({
  title: 'Transaction Broadcast | WcashExplorer',
  description: 'Transaction broadcast is disabled in the W.cash explorer.',
  path: '/tools/broadcast',
});

export default function BroadcastPage() {
  return <WcashUnavailable title="Transaction broadcast is disabled" detail="WcashExplorer is a read-only public scanner. It does not accept or relay raw transactions, and it never handles private keys." />;
}
