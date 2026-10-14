'use client';

import { useState, useEffect, useRef, memo, useCallback, type ReactNode } from 'react';
import { RelativeTime } from '@/components/RelativeTime';
import { formatTwcPrecise } from '@/lib/format-numbers';
import { HomeFeedTableSkeleton } from '@/components/HomeFeedTableSkeleton';
import { getApiUrl } from '@/lib/api-config';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ShieldFlowBadge, ShieldFlowLegend } from '@/components/ShieldFlowBadge';
import { resolveShieldFlowType } from '@/components/icons/shield-flow';
import { HashLink, RedactedAmount } from '@/components/ui';

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

function getKnownAmount(tx: ShieldedTx): number | null {
  if (tx.type === 'partial') {
    const amount = Math.abs(tx.valueBalanceIronwood || 0);
    return amount > 0 ? amount : null;
  }
  return null;
}

function normalizeRows(rows: any[]): ShieldedTx[] {
  return rows.map((tx) => ({
    txid: tx.txid,
    blockHeight: Number(tx.block_height ?? tx.blockHeight),
    blockTime: Number(tx.block_time ?? tx.blockTime),
    hasIronwood: Boolean(tx.has_ironwood ?? tx.hasIronwood),
    ironwoodActions: Number(tx.ironwood_actions ?? tx.ironwoodActions ?? 0),
    vinCount: Number(tx.vin_count ?? tx.vinCount ?? 0),
    voutCount: Number(tx.vout_count ?? tx.voutCount ?? 0),
    valueBalanceIronwood: tx.valueBalanceIronwood != null
      ? Number(tx.valueBalanceIronwood)
      : Number(tx.value_balance_ironwood || 0) / 100000000,
    type: Number(tx.vin_count ?? tx.vinCount ?? 0) === 0 && Number(tx.vout_count ?? tx.voutCount ?? 0) === 0
      ? 'fully-shielded'
      : 'partial',
  }));
}

interface RecentShieldedTxsProps {
  nested?: boolean;
  initialTxs?: ShieldedTx[];
  limit?: number;
  showLegend?: boolean;
  /** Rendered inside the card, below the table/legend (e.g. a "View all" link) — same slot DataTable's own `footer` prop fills. */
  footer?: ReactNode;
}

export const RecentShieldedTxs = memo(function RecentShieldedTxs({
  nested = false,
  initialTxs = [],
  limit = 5,
  showLegend = true,
  footer,
}: RecentShieldedTxsProps) {
  const [txs, setTxs] = useState<ShieldedTx[]>(initialTxs);
  const [loading, setLoading] = useState(initialTxs.length === 0);
  const latestKey = useRef(initialTxs[0]?.txid ?? '');
  const loadedOnce = useRef(initialTxs.length > 0);
  const latestBlockHeight = useRef(initialTxs[0]?.blockHeight ?? 0);
  const fetchRef = useRef<() => void>(() => {});

  const fetchTxs = useCallback(async () => {
    try {
      const apiUrl = `${getApiUrl()}/api/transactions/list?type=shielded&limit=${limit}`;

      const response = await fetch(apiUrl);
      const data = await response.json();
      const rows = normalizeRows(data.transactions || []);
      if (rows.length) {
        const newTopTxid = rows[0]?.txid;
        if (newTopTxid !== latestKey.current) {
          latestKey.current = newTopTxid;
          latestBlockHeight.current = rows[0]?.blockHeight ?? 0;
          setTxs(rows);
        }
      }
    } catch (error) {
      console.error('Error fetching shielded transactions:', error);
    } finally {
      if (!loadedOnce.current) {
        loadedOnce.current = true;
        setLoading(false);
      }
    }
  }, [limit]);

  fetchRef.current = fetchTxs;

  const handleWsMessage = useCallback((msg: any) => {
    if (msg.type === 'new_block' || msg.type === 'chain_tip') {
      const height = msg.data?.height;
      if (height && height > latestBlockHeight.current) {
        fetchRef.current();
      }
    }
  }, []);

  const { isConnected: wsConnected } = useWebSocket({ onMessage: handleWsMessage });

  useEffect(() => {
    if (initialTxs.length === 0) {
      fetchTxs();
    }

    const interval = setInterval(fetchTxs, wsConnected ? 60000 : 10000);
    return () => clearInterval(interval);
  }, [initialTxs.length, wsConnected, fetchTxs]);

  if (loading) {
    return <HomeFeedTableSkeleton rows={5} footer={footer} />;
  }

  return (
    <div className={nested ? '' : 'card p-0 overflow-hidden'}>
      {/* overflow-x-auto, not overflow-hidden: never silently clip a column, scroll instead */}
      <div className="overflow-x-auto no-scrollbar">
        {/* Live-row animations — DataTable lacks per-row classes; classes mirror its conventions */}
        <table className="w-full min-w-[420px]">
          <thead>
            <tr>
              <th className="px-4 sm:px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-cipher-border">TxID</th>
              {/* Shield/deshield direction — "Flow" matches the transaction list. */}
              <th className="px-4 sm:px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-cipher-border w-12">Flow</th>
              <th className="px-4 sm:px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-cipher-border">Amount</th>
              <th className="px-4 sm:px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-cipher-border">Age</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((tx, i) => {
              const knownAmount = getKnownAmount(tx);
              return (
                <tr
                  key={tx.txid}
                  className="group transition-colors duration-100 hover:bg-cipher-hover animate-fade-in-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <td className="px-4 sm:px-5 h-12 border-b border-cipher-border">
                    <HashLink
                      value={tx.txid}
                      href={`/tx/${tx.txid}`}
                      lead={10}
                      tail={6}
                      responsive
                      accent="purple"
                      linkClassName="font-mono text-sm font-medium text-primary hover:underline transition-colors truncate"
                    />
                  </td>
                  <td className="px-4 sm:px-5 h-12 border-b border-cipher-border">
                    <ShieldFlowBadge
                      type={resolveShieldFlowType({
                        type: tx.type,
                        vinCount: tx.vinCount,
                        voutCount: tx.voutCount,
                        valueBalanceSapling: 0,
                        valueBalanceOrchard: 0,
                        valueBalanceIronwood: tx.valueBalanceIronwood,
                      })}
                      variant="compact"
                    />
                  </td>
                  <td className="px-4 sm:px-5 h-12 border-b border-cipher-border text-right">
                    {knownAmount !== null ? (
                      <span className="font-mono text-sm text-secondary whitespace-nowrap tabular-nums">{formatTwcPrecise(knownAmount)} <span className="text-muted/50">TWC</span></span>
                    ) : (
                      <RedactedAmount />
                    )}
                  </td>
                  <td className="px-4 sm:px-5 h-12 border-b border-cipher-border text-right">
                    <RelativeTime timestamp={tx.blockTime} className="text-sm text-muted whitespace-nowrap" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showLegend && <ShieldFlowLegend />}
      {footer && <div className="px-4 py-3 border-t border-cipher-border flex items-center justify-center text-center">{footer}</div>}
    </div>
  );
});
