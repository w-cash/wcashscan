import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/SectionHeader';
import { WcashNetworkBanner } from '@/components/WcashNetworkBanner';
import { getApiUrl } from '@/lib/api-config';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'About WcashExplorer',
  description: 'WcashExplorer is the W.cash Testnet blockchain scanner built from the wcashscan UI and logic.',
  path: '/about',
  networks: ['mainnet'],
});

export default function AboutPage() {
  const apiUrl = getApiUrl();

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="ABOUT"
        title="WcashExplorer"
        subtitle="A W.cash-native explorer for verifiable chain data, with Testnet as the current source of truth."
      />
      <WcashNetworkBanner />

      <div className="grid gap-5 md:grid-cols-2 mt-6">
        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-primary">What this project is</h2>
            <p className="mt-3 text-sm leading-relaxed text-secondary">
              WcashExplorer uses the open-source <Link href="https://github.com/w-cash/wcashscan" target="_blank" rel="noreferrer" className="text-cipher-cyan hover:underline">wcashscan</Link> UI and logic, adapted for W.cash. The public site is a read-only presentation layer over a dedicated W.cash index and API.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-primary">Current source</h2>
            <p className="mt-3 text-sm leading-relaxed text-secondary">
              The active API is <code className="text-cipher-cyan">{apiUrl}</code>. Wolf provides node observations, the adapted indexer writes canonical data to PostgreSQL, and the frontend reads normalized API responses.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardBody>
          <h2 className="text-lg font-bold text-primary">Project boundaries</h2>
          <ul className="mt-4 space-y-3 text-sm text-secondary list-disc pl-5">
            <li>No legacy explorer data source is used for the scanner.</li>
            <li>No prices, valuations, cross-chain balances, or private wallet ownership are invented.</li>
            <li>Mainnet remains available as a preview and deliberately points at the Testnet API until a real W.cash mainnet endpoint is configured.</li>
            <li>Wallet scanning and transaction broadcast stay gated until their W.cash-native protocol paths are verified.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
