'use client';

import { memo, type ReactNode } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { CURRENCY } from '@/lib/config';

const CARD_HEIGHT_PX = 336.5;

interface IronwoodOverview {
  success: boolean;
  pool: { chainValue?: number | string | null } | null;
  indexed: {
    height: number;
    ironwoodTransactions: number;
    ironwoodActions: number;
    latestActivityHeight: number | null;
  };
  node: { height: number | null } | null;
}

function formatTwc(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { maximumFractionDigits: 8 })
    : '—';
}

/** Homepage W.cash value-pool card backed by the native Ironwood API. */
export const IronwoodProgressCard = memo(function IronwoodProgressCard({ footer }: { footer?: ReactNode } = {}) {
  const { data, loading, error } = useApiQuery<IronwoodOverview>('/api/ironwood/overview', undefined, {
    refreshInterval: 30_000,
  });

  if (loading) {
    return (
      <div className="card p-5 animate-pulse" style={{ height: CARD_HEIGHT_PX }}>
        <div className="h-3 w-32 skeleton-bg rounded mb-4" />
        <div className="h-8 w-40 skeleton-bg rounded mb-5" />
        <div className="h-2 w-full skeleton-bg rounded mb-5" />
        <div className="h-3 w-full skeleton-bg rounded mb-5" />
        <div className="h-3 w-full skeleton-bg rounded" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="card p-0 overflow-hidden flex flex-col" style={{ height: CARD_HEIGHT_PX }}>
        <div className="flex-1 flex items-center justify-center px-4 text-center text-sm text-muted font-mono">
          Ironwood activity is unavailable
        </div>
        {footer && <div className="px-4 py-3 border-t border-cipher-border text-center">{footer}</div>}
      </div>
    );
  }

  const indexedHeight = data.indexed.height.toLocaleString();
  const nodeHeight = data.node?.height == null ? '—' : `#${data.node.height.toLocaleString()}`;

  return (
    <div className="card p-0 overflow-hidden flex flex-col" style={{ height: CARD_HEIGHT_PX }}>
      <div className="px-5 py-4 flex-1 min-h-0">
        <span className="text-[10px] font-mono text-muted uppercase tracking-widest">IRONWOOD_VALUE_POOL</span>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-cipher-yellow tabular-nums">
            {formatTwc(data.pool?.chainValue)}
          </span>
          <span className="text-sm text-muted font-mono">{CURRENCY}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-cipher-border/50 pt-4">
          <div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest block mb-1">Indexed height</span>
            <span className="text-sm font-mono font-semibold text-primary tabular-nums">#{indexedHeight}</span>
          </div>
          <div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest block mb-1">Wolf height</span>
            <span className="text-sm font-mono font-semibold text-primary tabular-nums">{nodeHeight}</span>
          </div>
          <div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest block mb-1">Ironwood TXs</span>
            <span className="text-sm font-mono font-semibold text-primary tabular-nums">{data.indexed.ironwoodTransactions.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest block mb-1">Ironwood actions</span>
            <span className="text-sm font-mono font-semibold text-primary tabular-nums">{data.indexed.ironwoodActions.toLocaleString()}</span>
          </div>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          Aggregate public value-pool balance from Wolf; transaction activity comes from the WcashExplorer PostgreSQL index.
        </p>
      </div>
      {footer && <div className="px-4 py-3 border-t border-cipher-border text-center">{footer}</div>}
    </div>
  );
});
