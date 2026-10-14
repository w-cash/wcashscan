'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { getChartColors } from '@/lib/chart-theme';
import { useApiQuery } from '@/hooks/useApiQuery';
import { ChartCard } from './ChartCard';

export interface ProtocolPoint {
  month: string;
  ironwoodActions: number;
}

export interface ProtocolStatsResponse {
  success: boolean;
  network?: string;
  ticker?: string;
  current: { ironwoodActions: number };
  history: ProtocolPoint[];
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

type Period = '2y' | '4y' | 'all';

export function ProtocolStatsChart({ initialData }: { initialData?: ProtocolStatsResponse | null }) {
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const [period, setPeriod] = useState<Period>('4y');

  const { data, loading } = useApiQuery<ProtocolStatsResponse>(
    '/api/network/protocol-stats',
    undefined,
    { initialData: initialData ?? undefined },
  );

  const points = useMemo(() => {
    const history = (data?.history ?? []).filter((point) => point.ironwoodActions > 0);
    if (period === 'all') return history;
    const years = period === '2y' ? 2 : 4;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return history.filter((point) => new Date(point.month) >= cutoff);
  }, [data, period]);

  const chartData = points.map((point) => ({
    ...point,
    label: new Date(point.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
  }));

  const controls = (
    <div className="flex gap-1">
      {(['2y', '4y', 'all'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setPeriod(value)}
          className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
            period === value ? 'bg-cipher-cyan/20 text-cipher-cyan' : 'text-muted hover:text-secondary'
          }`}
        >
          {value === 'all' ? 'All' : value.toUpperCase()}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <ChartCard title="IRONWOOD_ACTIVITY" height={280} watermarkSize="sm" controls={controls}>
        <div className="flex items-center justify-center h-[280px] text-xs text-muted">Loading Ironwood activity…</div>
      </ChartCard>
    );
  }

  if (!chartData.length) {
    return (
      <ChartCard title="IRONWOOD_ACTIVITY" height={280} watermarkSize="sm" controls={controls}>
        <div className="flex items-center justify-center h-[280px] text-xs text-muted text-center px-6">
          No Ironwood action history is available for this window yet.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="IRONWOOD_ACTIVITY" height={280} watermarkSize="sm" controls={controls}>
      <div className="mb-3">
        <div className="text-[10px] font-mono text-muted">
          Indexed Ironwood actions:{' '}
          <span className="text-cipher-yellow font-semibold">{formatCount(data?.current?.ironwoodActions ?? 0)}</span>
        </div>
        <p className="text-[9px] font-mono text-muted/60 mt-1.5">
          Action counts come from canonical W.cash transactions. They are not a user count and are not a separate nullifier census.
        </p>
      </div>
      <ResponsiveContainer initialDimension={{ width: 500, height: 300 }} width="100%" height={235}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="2 6" stroke={colors.grid} opacity={0.5} />
          <XAxis dataKey="label" stroke={colors.axis} tick={{ fill: colors.axis, fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis stroke={colors.axis} tick={{ fill: colors.axis, fontSize: 9 }} tickFormatter={formatCount} width={42} domain={[0, 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: colors.tooltipText, fontFamily: 'var(--font-mono)', fontSize: 10 }}
            formatter={(value) => [formatCount(Number(value)), 'Ironwood actions']}
          />
          <Area type="monotone" dataKey="ironwoodActions" name="Ironwood actions" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
