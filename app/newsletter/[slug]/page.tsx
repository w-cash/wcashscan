import { buildPageMetadata } from '@/lib/seo';
import { WcashUnavailable } from '@/components/WcashUnavailable';

export const metadata = buildPageMetadata({
  title: 'W.cash Update | WcashExplorer',
  description: 'WcashExplorer project updates are not published yet.',
  path: '/newsletter',
  networks: ['mainnet'],
});

export default function NewsletterIssuePage() {
  return <WcashUnavailable title="W.cash update not available" detail="Legacy newsletter issues are not part of the WcashExplorer scanner. New W.cash-native release notes can be published here later." />;
}
