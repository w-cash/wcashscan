import { buildPageMetadata } from '@/lib/seo';
import { WcashUnavailable } from '@/components/WcashUnavailable';

export const metadata = buildPageMetadata({
  title: 'W.cash Updates | WcashExplorer',
  description: 'WcashExplorer project updates and scanner release notes.',
  path: '/newsletter',
  networks: ['mainnet'],
});

export default function NewsletterPage() {
  return <WcashUnavailable title="W.cash updates are not published yet" detail="This route is reserved for WcashExplorer release notes and W.cash network updates. It does not reuse legacy explorer newsletter content." />;
}
