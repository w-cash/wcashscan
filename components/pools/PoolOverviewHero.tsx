'use client';

import { useMemo, useState } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatTwcCompact, zatToTwc } from '@/lib/format-numbers';
import { useTheme } from '@/contexts/ThemeContext';
import { getChartColors } from '@/lib/chart-theme';
import { SupplyTreemap } from './SupplyTreemap';
import {
  buildShieldedPoolSegments,
  buildTopLevelSegments,
  hasValidSupplyTotals,
  type SupplyPoolKey,
} from './supply-treemap-layout';

export interface PoolOverviewData {
  current: {
    ironwood: number;
    transparent: number;
    shielded: number;
    chainSupply: number;
    updatedAt: string;
  };
  deltas: Record<string, Record<string, number | null>>;
}

interface PoolHistoryResponse {
  points: Array<{ date: string; ironwood: number; transparent: number; shielded: number; chainSupply: number | null }>;
  coverageStart?: string | null;
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown time' : date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function PoolOverviewHero({ data }: { data: PoolOverviewData }) {
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const [hoveredKey, setHoveredKey] = useState<SupplyPoolKey | null>(null);
  const [pinnedShielded, setPinnedShielded] = useState(false);
  const { current, deltas } = data;
  const { data: history } = useApiQuery<PoolHistoryResponse>('/api/network/pool-history', { period: 'all' });

  const topLevel = useMemo(() => {
    if (!hasValidSupplyTotals({ transparent: current.transparent, shielded: current.shielded, chainSupply: current.chainSupply })) return [];
    return buildTopLevelSegments({
      transparent: current.transparent,
      shielded: current.shielded,
      chainSupply: current.chainSupply,
      colors: { transparent: colors.transparent, shielded: colors.yellow, unmined: colors.axis },
    });
  }, [current, colors]);

  const shieldedChildren = useMemo(() => buildShieldedPoolSegments({
    sprout: 0,
    sapling: 0,
    orchard: 0,
    ironwood: current.ironwood,
    colors: {
      sprout: colors.axis,
      sapling: colors.axis,
      orchard: colors.axis,
      ironwood: colors.ironwood,
    },
  }), [current.ironwood, colors]);

  const issuedTwc = zatToTwc(current.chainSupply);
  const ironwoodTwc = zatToTwc(current.ironwood);
  const transparentTwc = zatToTwc(current.transparent);
  const unminedTwc = Math.max(0, 21_000_000 - issuedTwc);
  const ironwoodPct = issuedTwc > 0 ? (ironwoodTwc / issuedTwc) * 100 : 0;
  const delta7d = deltas.ironwood?.['7d'];

  if (!topLevel.length) {
    return <p className="py-12 text-center text-xs text-muted font-mono" role="status">
      W.cash supply map unavailable: the latest snapshot has missing or inconsistent totals.
    </p>;
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-bold font-mono text-secondary uppercase tracking-wider">ISSUED_SUPPLY_MAP</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
              Canonical W.cash supply snapshot: transparent TWC, the Ironwood pool, and not-yet-issued TWC against the 21M ceiling.
            </p>
          </div>
          <div className="text-right text-[10px] font-mono text-muted">
            <div>updated {formatUpdated(current.updatedAt)}</div>
            <div>source: PostgreSQL snapshot</div>
          </div>
        </div>

        <div className="wcash-supply-map overflow-hidden rounded-xl border border-cipher-border/30">
          <SupplyTreemap
            topLevel={topLevel}
            shieldedChildren={shieldedChildren}
            hoveredKey={hoveredKey}
            pinnedShielded={pinnedShielded}
            onHover={setHoveredKey}
            onTogglePinShielded={() => setPinnedShielded((value) => !value)}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SupplyStat label="Transparent" value={transparentTwc} color={colors.transparent} />
          <SupplyStat label="Ironwood" value={ironwoodTwc} color={colors.ironwood} footnote={`${ironwoodPct.toFixed(1)}% of issued`} />
          <SupplyStat label="Issued" value={issuedTwc} color={colors.yellow} />
          <SupplyStat label="Unmined" value={unminedTwc} color={colors.axis} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted">
          <span>
            {delta7d == null ? 'Ironwood 7d change unavailable' : `Ironwood 7d change: ${delta7d >= 0 ? '+' : ''}${formatTwcCompact(zatToTwc(delta7d))} TWC`}
          </span>
          <span>{history?.coverageStart ? `history from ${history.coverageStart}` : 'history begins after snapshot jobs run'}</span>
        </div>
      </CardBody>
    </Card>
  );
}

function SupplyStat({ label, value, color, footnote }: { label: string; value: number; color: string; footnote?: string }) {
  return (
    <div className="rounded-xl border border-cipher-border/50 p-3">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </div>
      <p className="mt-2 text-lg font-bold font-mono tabular-nums text-primary">{formatTwcCompact(value)} <span className="text-xs font-normal text-muted">TWC</span></p>
      {footnote && <p className="mt-1 text-[10px] font-mono text-muted">{footnote}</p>}
    </div>
  );
}

export function PoolOverviewSkeleton() {
  return (
    <div className="rounded-2xl border border-cipher-border bg-cipher-surface p-5 sm:p-6">
      <div className="mb-5 h-4 w-44 skeleton-bg rounded animate-pulse" />
      <div className="h-[220px] sm:h-[280px] skeleton-bg rounded-xl animate-pulse" />
      <div className="mt-3 h-4 w-1/2 skeleton-bg rounded animate-pulse" />
      <div className="mt-4 h-10 skeleton-bg rounded-xl animate-pulse" />
    </div>
  );
}
