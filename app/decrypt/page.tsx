import { buildPageMetadata } from '@/lib/seo';
import { WcashUnavailable } from '@/components/WcashUnavailable';

export const metadata = buildPageMetadata({
  title: 'Memo Decryption | WcashExplorer',
  description: 'Memo decryption is not enabled in the W.cash explorer.',
  path: '/decrypt',
  networks: ['mainnet'],
});

export default function DecryptPage() {
  return (
    <WcashUnavailable
      title="Memo decryption is disabled"
      detail="WcashExplorer does not accept viewing keys or attempt to decode private Ironwood recipients. A future W.cash-reviewed client-side implementation can be added without changing the public scanner data path."
    />
  );
}
