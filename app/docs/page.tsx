'use client';

import Link from 'next/link';
import ApiEndpoint from './components/ApiEndpoint';
import ApiSidebar from './components/ApiSidebar';
import { getApiUrl, NETWORK } from '@/lib/api-config';
import { getEndpointsByCategory } from './endpoints';

export default function DocsPage() {
  const baseUrl = getApiUrl();
  const categories = getEndpointsByCategory(baseUrl);
  const endpointCount = categories.reduce((total, category) => total + category.endpoints.length, 0);
  const networkLabel = NETWORK === 'mainnet' ? 'Mainnet preview' : 'Testnet';

  return (
    <div className="min-h-screen flex">
      <ApiSidebar categories={categories.map(({ name, endpoints }) => ({
        name,
        endpoints: endpoints.map(({ id, path, method }) => ({ id, path, method })),
      }))} />

      <main className="flex-1 py-10 px-4 lg:px-12 max-w-6xl">
        <Link href="/" className="text-sm font-mono text-cipher-cyan hover:text-cipher-green">← Back to WcashExplorer</Link>
        <div className="mt-6 mb-10">
          <p className="text-xs font-mono uppercase tracking-wider text-cipher-yellow">W.cash public data API</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-bold font-mono text-primary">API documentation</h1>
          <p className="mt-4 max-w-3xl text-secondary">
            {endpointCount} read-focused endpoints for W.cash blocks, transactions, public addresses, Ironwood activity, mining, and network health. The browser reads this API; it never connects directly to Wolf or PostgreSQL.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          <div className="card"><div className="text-xs text-muted">API base</div><code className="mt-2 block text-sm text-cipher-cyan break-all">{baseUrl}</code></div>
          <div className="card"><div className="text-xs text-muted">Active profile</div><div className="mt-2 font-bold text-primary">{networkLabel}</div><div className="text-xs text-muted">{NETWORK === 'mainnet' ? 'same Testnet API during preview' : 'W.cash Testnet data'}</div></div>
          <div className="card"><div className="text-xs text-muted">Units</div><div className="mt-2 font-bold text-primary">TWC / zatoshi</div><div className="text-xs text-muted">1 TWC = 100,000,000 zatoshi</div></div>
          <div className="card"><div className="text-xs text-muted">Authentication</div><div className="mt-2 font-bold text-cipher-green">Public reads</div><div className="text-xs text-muted">deployment rate limits apply</div></div>
        </div>

        <section className="card gradient-card-purple mb-10">
          <h2 className="text-lg font-bold text-primary">Data and privacy boundary</h2>
          <p className="mt-3 text-sm leading-relaxed text-secondary">
            The ingestion path is Wolf RPC → the adapted Wcash indexer → PostgreSQL → this API → the Next.js dashboards. Public transparent inputs/outputs and Ironwood counts are indexed. Private recipients, ownership, price, valuation, cross-chain activity, and wallet identity are not fabricated; unsupported views return an explicit <code className="text-cipher-cyan">available: false</code> response.
          </p>
        </section>

        <div className="space-y-10">
          {categories.map((category) => (
            <section key={category.name}>
              <div className="flex items-baseline justify-between border-b border-cipher-border pb-3 mb-4">
                <h2 className="text-2xl font-bold font-mono text-primary">{category.name}</h2>
                <span className="text-xs font-mono text-muted">{category.endpoints.length} endpoint{category.endpoints.length === 1 ? '' : 's'}</span>
              </div>
              <div className="space-y-4">
                {category.endpoints.map((item) => <ApiEndpoint key={item.id} endpoint={item} />)}
              </div>
            </section>
          ))}
        </div>

        <section className="card mt-10">
          <h2 className="text-lg font-bold text-primary">Reliable client behaviour</h2>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-cipher-border bg-cipher-bg-dark p-4 text-xs text-secondary">{`const base = '${baseUrl}';
const response = await fetch(base + '/api/blocks?limit=10');
if (!response.ok) throw new Error('Wcash API unavailable');
const { blocks } = await response.json();`}</pre>
          <p className="mt-4 text-sm text-muted">Use `/health/deep` before a deployment is marked ready. Treat `available: false` as a supported capability boundary, not as zero data.</p>
        </section>
      </main>
    </div>
  );
}
