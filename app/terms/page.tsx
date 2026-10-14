import Link from 'next/link';
import { buildPageMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/ui/SectionHeader';

export const metadata = buildPageMetadata({
  title: 'Terms of Service | WcashExplorer',
  description: 'Terms for using the WcashExplorer W.cash blockchain scanner and public API.',
  path: '/terms',
  networks: ['mainnet'],
});

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="LEGAL" title="Terms of Service" subtitle="Last updated: September 15, 2026" />
      <div className="prose-legal space-y-8 text-sm text-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">1. Service</h2>
          <p>WcashExplorer is an open-source, informational explorer for publicly observable W.cash blockchain data. The service includes a public API and dashboards backed by a W.cash Wolf node, an adapted indexer, and PostgreSQL.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">2. Accuracy and availability</h2>
          <p>Data can be delayed, incomplete, re-organized, or unavailable while the node and indexer catch up. A mainnet-preview page may display Testnet data and is clearly labelled. Do not treat the scanner as a settlement source or as financial, legal, tax, or investment advice.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">3. User responsibility</h2>
          <p>Verify addresses, amounts, network, and transaction status independently before taking action. Keep private keys, viewing keys, tokens, and credentials out of issue reports, handoff files, and public requests. WcashExplorer does not custody funds.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">4. Acceptable use</h2>
          <p>Use the public API responsibly, respect deployment rate limits, and do not attempt to bypass access controls, overload the service, or use the site for unlawful activity.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">5. Open source</h2>
          <p>The implementation is developed from the <Link href="https://github.com/w-cash/wcashscan" target="_blank" rel="noreferrer" className="text-cipher-cyan hover:underline">w-cash/wcashscan</Link> codebase and related W.cash components. Repository files and their licenses govern the source code.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">6. Changes</h2>
          <p>We may change, pause, or remove dashboards and API endpoints as the W.cash protocol and deployment evolve. Continued use after a change means you accept the updated terms.</p>
        </section>
      </div>
    </div>
  );
}
