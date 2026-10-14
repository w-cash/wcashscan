import { buildPageMetadata } from '@/lib/seo';
import { WcashUnavailable } from '@/components/WcashUnavailable';

export const metadata = buildPageMetadata({
  title: 'Ironwood Anchor Search | WcashExplorer',
  description: 'Ironwood anchor search will be enabled when the W.cash index contains verified anchor observations.',
  keywords: ['W.cash Ironwood', 'TWC anchor root'],
  path: '/tools/anchor-search',
});

export default function AnchorSearchPage() {
  return <WcashUnavailable title="Ironwood anchor search is not available yet" detail="The indexer schema has an anchor field, but this dashboard stays unavailable until the local W.cash anchor data has been verified against Wolf." />;
}
