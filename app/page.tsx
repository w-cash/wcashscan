import Link from 'next/link';
import Image from 'next/image';
import { SearchBar } from '@/components/SearchBar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HomeFeedCard } from '@/components/HomeFeedCard';
import { RelativeTimeProvider } from '@/components/RelativeTime';
import { RecentMempool } from '@/components/RecentMempool';
import { getApiUrl } from '@/lib/api-config';
import { isTestnet } from '@/lib/config';
import { fetchWithDeadline } from '@/lib/server-fetch';
import { retainLastGoodOrBuildFallback } from '@/lib/isr-fallback';

export const revalidate = 30;

interface Block {
  height: number;
  hash: string;
  timestamp: number;
  transactions: number;
  size: number;
}

interface ShieldedTx {
  txid: string;
  blockHeight: number;
  blockTime: number;
  hasIronwood: boolean;
  ironwoodActions: number;
  vinCount: number;
  voutCount: number;
  valueBalanceIronwood: number;
  type: 'fully-shielded' | 'partial';
}

const API_URL = getApiUrl();

function upstreamError(context: string, status: number): Error {
  return new Error(`${context} returned HTTP ${status}`);
}

async function getRecentBlocks(): Promise<Block[]> {
  try {
    const response = await fetchWithDeadline(`${API_URL}/api/blocks?limit=5`, {
      next: { revalidate: 30, tags: ['chain-tip'] },
    });

    if (!response.ok) throw upstreamError('Recent blocks', response.status);

    const data = await response.json();
    if (!Array.isArray(data.blocks)) throw new Error('Recent blocks payload is malformed');
    return data.blocks.map((b: any) => ({
      height: parseInt(b.height),
      hash: b.hash,
      timestamp: parseInt(b.timestamp),
      transactions: parseInt(b.transaction_count),
      size: parseInt(b.size),
    }));
  } catch (error) {
    console.error('Error fetching blocks:', error);
    return retainLastGoodOrBuildFallback([], error, 'homepage recent blocks');
  }
}

async function getRecentShieldedTxs(): Promise<ShieldedTx[]> {
  try {
    const response = await fetchWithDeadline(`${API_URL}/api/transactions/list?type=shielded&limit=5`, {
      next: { revalidate: 30, tags: ['chain-tip'] },
    });

    if (!response.ok) throw upstreamError('Recent shielded transactions', response.status);

    const data = await response.json();
    if (!Array.isArray(data.transactions)) {
      throw new Error('Recent shielded transactions payload is malformed');
    }
    return data.transactions.map((tx: any) => ({
      txid: tx.txid,
      blockHeight: Number(tx.block_height),
      blockTime: Number(tx.block_time),
      hasIronwood: Boolean(tx.has_ironwood),
      ironwoodActions: Number(tx.ironwood_actions || 0),
      vinCount: Number(tx.vin_count || 0),
      voutCount: Number(tx.vout_count || 0),
      valueBalanceIronwood: Number(tx.value_balance_ironwood || 0) / 100000000,
      type: Number(tx.vin_count || 0) === 0 && Number(tx.vout_count || 0) === 0 ? 'fully-shielded' : 'partial',
    }));
  } catch (error) {
    console.error('Error fetching shielded txs:', error);
    return retainLastGoodOrBuildFallback([], error, 'homepage recent shielded transactions');
  }
}

export default async function Home() {
  const [initialBlocks, initialShieldedTxs] = await Promise.all([
    getRecentBlocks(),
    getRecentShieldedTxs(),
  ]);

  return (
    <div className="home-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      {/* Hero Section - z-index for dropdown to appear above widgets */}
      <div className="text-center mb-10 sm:mb-14 relative z-30">
        {/* Tagline - SEO friendly */}
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-primary mb-3 sm:mb-4 animate-fade-in inline-flex items-center justify-center gap-3 tracking-tight text-balance">
            <Image
            src="/logo.png"
            alt="W.cash"
            width={32}
            height={32}
            priority
            className="w-7 h-7 sm:w-8 sm:h-8"
          />
          {isTestnet
            ? 'WcashExplorer: W.cash Testnet Explorer'
            : 'WcashExplorer: W.cash Mainnet Preview'}
        </h1>
        <p className="text-sm sm:text-base text-muted/60 mb-7 sm:mb-8 max-w-xl mx-auto text-center leading-relaxed">
          {isTestnet
            ? 'Search W.cash Testnet blocks, transactions, transparent addresses, and mining activity in real time.'
            : 'Mainnet preview using W.cash Testnet data. Explore blocks, transactions, addresses, and network activity.'}
        </p>

        {/* Search Section */}
        <div>
          <SearchBar />
        </div>
      </div>

      <RelativeTimeProvider initialNow={Date.now()}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mt-10 sm:mt-12 lg:mt-16">
          <HomeFeedCard
            storageKey="wcashscan-home-card-left"
            defaultType="blocks"
            initialBlocks={initialBlocks}
          />
          <HomeFeedCard
            storageKey="wcashscan-home-card-right"
            defaultType="shielded"
            initialShieldedTxs={initialShieldedTxs}
          />
        </div>
      </RelativeTimeProvider>

      {/* Pending Mempool — fixed, not customizable: always the baseline
          "what's about to confirm" view regardless of what the two cards
          above are set to. */}
      <div className="mt-10 sm:mt-12 lg:mt-16">
        <SectionHeader label="MEMPOOL" live size="lg" />
        <RecentMempool
          footer={
            <Link href="/mempool" className="text-xs sm:text-sm font-mono text-muted hover:text-primary transition-colors">
              View all
            </Link>
          }
        />
      </div>
    </div>
  );
}
