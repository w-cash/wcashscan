import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/SectionHeader';
import { WCASH_TESTNET_PROFILE } from '@/lib/wcash-profile';

const sections = [
  {
    title: 'What W.cash is',
    text: 'W.cash is a proof-of-work chain whose native unit is TWC. WcashExplorer makes its public chain state readable: blocks, transactions, transparent addresses, Ironwood activity, mining observations, and node health.',
  },
  {
    title: 'Transparent and Ironwood data',
    text: 'Transparent inputs and outputs can be indexed and queried as public chain data. Ironwood counts, value-balance fields, and commitment roots are shown when the W.cash node and indexer provide them. Private recipients and ownership are never guessed from encrypted data.',
  },
  {
    title: 'How the scanner works',
    text: 'Wolf exposes W.cash RPC. The adapted Wcash indexer validates the configured genesis and branch identity, follows canonical blocks, and writes normalized rows to PostgreSQL. The API reads those rows and the dashboards consume the API over HTTP and WebSocket.',
  },
];

export default function LearnPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="LEARN"
        title="Understand W.cash"
        subtitle="A short guide to the chain data that WcashExplorer can verify and the privacy boundaries it will not cross."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardBody>
              <h2 className="text-lg font-bold text-primary">{section.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{section.text}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 mt-6">
        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-primary">Testnet profile</h2>
            <dl className="mt-4 divide-y divide-cipher-border text-sm">
              <div className="flex justify-between gap-4 py-3"><dt className="text-muted">Genesis</dt><dd className="font-mono text-secondary break-all text-right">{WCASH_TESTNET_PROFILE.genesisHash}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-muted">Target spacing</dt><dd className="font-mono text-secondary">{WCASH_TESTNET_PROFILE.targetSpacingSeconds}s</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-muted">Halving interval</dt><dd className="font-mono text-secondary">{WCASH_TESTNET_PROFILE.halvingInterval.toLocaleString()} blocks</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-muted">Smallest unit</dt><dd className="font-mono text-secondary">zatoshi</dd></div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-primary">Address and capability notes</h2>
            <ul className="mt-4 space-y-3 text-sm text-secondary list-disc pl-5">
              <li>Testnet unified addresses begin with <code className="text-cipher-cyan">{WCASH_TESTNET_PROFILE.addressPrefixes?.unified}…</code>.</li>
              <li>Testnet TEX addresses begin with <code className="text-cipher-cyan">{WCASH_TESTNET_PROFILE.addressPrefixes?.tex}…</code>.</li>
              <li>Private receiver balances, wallet scanning, and broadcast remain explicitly gated until the W.cash-native implementation is verified.</li>
              <li>Mainnet is a preview and currently reads the Testnet API. It is not monetary mainnet data.</li>
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardBody>
          <h2 className="text-lg font-bold text-primary">Continue exploring</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/blocks" className="filter-btn">Blocks</Link>
            <Link href="/txs" className="filter-btn">Transactions</Link>
            <Link href="/network" className="filter-btn">Network</Link>
            <Link href="/docs" className="filter-btn">API docs</Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
