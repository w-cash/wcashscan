import Link from 'next/link';
import { PageHeader } from '@/components/ui/SectionHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { WcashUnavailable } from '@/components/WcashUnavailable';

const tools = [
  {
    href: '/tools/unit-converter',
    title: 'TWC unit converter',
    detail: 'Convert TWC amounts to zatoshi without contacting the API or a wallet.',
  },
  {
    href: '/docs',
    title: 'API documentation',
    detail: 'Inspect the read-only WcashExplorer API and its source/availability fields.',
  },
  {
    href: '/tools/anchor-search',
    title: 'Ironwood anchor search',
    detail: 'Search indexed Ironwood anchor observations when the indexer has captured them.',
  },
];

export default function ToolsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <PageHeader
        eyebrow="WCASH_TOOLS"
        title="W.cash developer tools"
        subtitle="Read-only utilities for the W.cash chain. Wallet scanning, decryption, and transaction broadcast stay disabled until a W.cash-reviewed implementation exists."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {tools.map((tool) => (
          <Card key={tool.href} className="h-full">
            <CardBody className="h-full flex flex-col">
              <h2 className="text-sm font-bold font-mono text-primary">{tool.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-secondary flex-1">{tool.detail}</p>
              <Link href={tool.href} className="mt-4 text-xs font-mono text-cipher-cyan hover:underline">Open tool →</Link>
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <WcashUnavailable
          title="Wallet actions are disabled"
          detail="This explorer does not accept viewing keys, private keys, or raw transactions. The browser reads indexed public chain data through the WcashExplorer API; it never talks directly to Wolf."
        />
      </div>
    </div>
  );
}
