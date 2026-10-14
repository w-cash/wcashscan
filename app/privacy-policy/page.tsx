import Link from 'next/link';
import { buildPageMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/ui/SectionHeader';

export const metadata = buildPageMetadata({
  title: 'Privacy Policy | WcashExplorer',
  description: 'How WcashExplorer handles service requests and public W.cash blockchain data.',
  path: '/privacy-policy',
  networks: ['mainnet'],
});

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="LEGAL" title="Privacy Policy" subtitle="Last updated: September 15, 2026" />
      <div className="prose-legal space-y-8 text-sm text-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">Public chain data</h2>
          <p>WcashExplorer displays data that is already observable on the W.cash network or produced by the site&apos;s own indexer. Transparent addresses, public outputs, block metadata, and transaction identifiers are not private information created by this service.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">Requests and logs</h2>
          <p>The API may record operational request metadata such as timestamps, status codes, latency, rate-limit counters, and redacted paths to keep the service reliable and secure. Dynamic transaction hashes, addresses, and amounts are redacted from application request logs where supported.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">No keys or credentials</h2>
          <p>Do not submit private keys, viewing keys, API tokens, passwords, or wallet credentials to WcashExplorer. The scanner does not require them for public browsing. Wallet and broadcast features remain gated until a reviewed W.cash-native implementation exists.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">Privacy analytics</h2>
          <p>Ironwood analytics are conservative observations of public amounts, timing, and transaction structure. They do not identify private recipients, prove ownership, or recover encrypted memos. Unsupported analyses are marked unavailable rather than inferred.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">Third parties</h2>
          <p>The site does not rely on a legacy scanner, cross-chain swap, pricing, or valuation provider. If a deployment adds an external service, its own policy and the deployment notice will govern that integration.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">Contact</h2>
          <p>For implementation or data-source questions, open an issue in the <Link href="https://github.com/w-cash/wcashscan" target="_blank" rel="noreferrer" className="text-cipher-cyan hover:underline">WcashScan repository</Link>. Never include secrets in an issue.</p>
        </section>
      </div>
    </div>
  );
}
