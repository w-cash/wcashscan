import NetworkClient, { type NetworkPageInitialData } from './NetworkClient';
import { getApiUrl } from '@/lib/seo';
import { fetchWithDeadline } from '@/lib/server-fetch';

// Both the Testnet site and the Mainnet preview intentionally consume the
// same W.cash API.  The frontend build target is not the API's chain identity.
const WCASH_API_NETWORK = 'wcash';

async function fetchJson<T>(
  apiBase: string,
  path: string,
  revalidate: number,
  expectedNetwork: string,
): Promise<T | null> {
  try {
    const response = await fetchWithDeadline(`${apiBase}${path}`, {
      next: { revalidate },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.network && data.network !== expectedNetwork) return null;
    return data as T;
  } catch {
    return null;
  }
}

export default async function NetworkPage() {
  const apiBase = getApiUrl();
  const fetchedAt = Date.now();

  const [
    stats,
    health,
    breakdown,
    halving,
    emission,
    nodeLocations,
    nodeStats,
    recentBlocks,
    poolHistory,
    chainSizeHistory,
    feeDistribution,
    protocolStats,
  ] = await Promise.all([
    fetchJson<NetworkPageInitialData['stats']>(apiBase, '/api/network/stats', 30, WCASH_API_NETWORK),
    fetchJson<NetworkPageInitialData['health']>(apiBase, '/api/network/health', 60, WCASH_API_NETWORK),
    fetchJson<NetworkPageInitialData['breakdown']>(
      apiBase,
      '/api/supply/transparent-breakdown',
      300,
      WCASH_API_NETWORK,
    ),
    fetchJson<NetworkPageInitialData['halving']>(apiBase, '/api/network/halving', 300, WCASH_API_NETWORK),
    fetchJson<NetworkPageInitialData['emission']>(
      apiBase,
      '/api/network/emission?period=1y',
      300,
      WCASH_API_NETWORK,
    ),
    fetchJson<NetworkPageInitialData['nodeLocations']>(
      apiBase,
      '/api/network/nodes',
      300,
      WCASH_API_NETWORK,
    ),
    fetchJson<NetworkPageInitialData['nodeStats']>(
      apiBase,
      '/api/network/nodes/stats',
      300,
      WCASH_API_NETWORK,
    ),
    fetchJson<NetworkPageInitialData['recentBlocks']>(
      apiBase,
      '/api/network/blocks/recent?limit=15',
      30,
      WCASH_API_NETWORK,
    ),
    fetchJson<NetworkPageInitialData['poolHistory']>(
      apiBase,
      '/api/network/pool-history?period=all',
      300,
      WCASH_API_NETWORK,
    ),
    fetchJson<NetworkPageInitialData['chainSizeHistory']>(
      apiBase,
      '/api/network/chain-size-history?period=1y',
      300,
      WCASH_API_NETWORK,
    ),
    fetchJson<NetworkPageInitialData['feeDistribution']>(
      apiBase,
      '/api/network/fee-distribution?period=30d',
      300,
      WCASH_API_NETWORK,
    ),
    fetchJson<NetworkPageInitialData['protocolStats']>(
      apiBase,
      '/api/network/protocol-stats',
      300,
      WCASH_API_NETWORK,
    ),
  ]);

  const initialData: NetworkPageInitialData = {
    fetchedAt,
    stats,
    health,
    breakdown,
    halving,
    emission,
    nodeLocations,
    nodeStats,
    recentBlocks,
    poolHistory,
    chainSizeHistory,
    feeDistribution,
    protocolStats,
  };

  return (
    <>
      <NetworkClient initialData={initialData} />

      {/* Static page description — server-rendered for indexing */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="border-t border-cipher-border pt-8 max-w-3xl">
          <h2 className="text-sm font-bold font-mono text-secondary mb-3 uppercase tracking-wider">
            About the W.cash Network
          </h2>
          <div className="space-y-3 text-sm text-muted leading-relaxed">
            <p>
              W.cash is a proof-of-work blockchain secured by Equihash mining, with a block
              target of 75 seconds and a 21 million TWC monetary ceiling. This page tracks
              the network&apos;s vital signs: chain height, hashrate, difficulty, connected
              peers, observed node-software diversity, and the split of issued supply
              between the transparent and Ironwood pools.
            </p>
            <p>
              Supply numbers distinguish transparent TWC (publicly auditable) from shielded
              TWC held in the Ironwood pool, where individual balances remain private while
              the aggregate pool total is verifiable. Mining pool distribution is derived
              from coinbase markers and shows how concentrated block production currently is.
              Peer software percentages are a sample from WcashExplorer&apos;s live connections,
              not a complete census of every W.cash node.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
