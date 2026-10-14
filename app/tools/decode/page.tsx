import { buildPageMetadata } from '@/lib/seo';
import { WcashUnavailable } from '@/components/WcashUnavailable';

export const metadata = buildPageMetadata({
  title: 'Raw Transaction Decoder | WcashExplorer',
  description: 'Raw transaction decoding is not enabled until a W.cash-native parser is reviewed.',
  path: '/tools/decode',
  networks: ['mainnet'],
});

export default function DecodePage() {
  return <WcashUnavailable title="Raw transaction decoding is unavailable" detail="The public scanner displays transactions parsed by the W.cash indexer. It does not accept arbitrary raw transaction bytes in the browser." />;
}
