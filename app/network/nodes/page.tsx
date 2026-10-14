import { buildPageMetadata } from '@/lib/seo';
import NodesClient from './NodesClient';

export const metadata = buildPageMetadata({
  title: 'W.cash Network Nodes | WcashExplorer',
  description: 'Explore the W.cash peer-to-peer network: verified reachable nodes, client implementations, version adoption, and geographic distribution.',
  keywords: ['W.cash nodes', 'W.cash network nodes', 'W.cash peer network', 'Wolf nodes', 'W.cash node map'],
  path: '/network/nodes',
});

export default function NodesPage() {
  return (
    <>
      <NodesClient />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="border-t border-cipher-border pt-8 max-w-3xl">
          <h2 className="text-sm font-bold font-mono text-secondary mb-3 uppercase tracking-wider">
            About Network Nodes
          </h2>
          <div className="space-y-3 text-sm text-muted leading-relaxed">
            <p>
              This page shows every W.cash node verified as reachable by WcashExplorer&apos;s
              network crawler. Each node is discovered via recursive peer exchange and
              confirmed through a full protocol handshake, providing client
              identification and version information.
            </p>
            <p>
              Node locations are rounded to coarse geographic cells to protect operator privacy.
              No IP addresses or exact coordinates are exposed. Tor hidden service nodes
              appear without geographic placement. This product includes GeoLite2 data
              created by MaxMind, available from{' '}
              <a href="https://www.maxmind.com" className="text-accent hover:underline" rel="noopener noreferrer" target="_blank">
                maxmind.com
              </a>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
