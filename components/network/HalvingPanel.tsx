'use client';

import { Card, CardBody } from '@/components/ui/Card';
import { formatDuration } from '@/lib/format-numbers';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { getChartColors } from '@/lib/chart-theme';

export interface HalvingInfo {
  halvingBlock: number | null;
  blocksRemaining: number | null;
  eraProgress?: number;
  currentSubsidy: number | null;
  nextSubsidy: number | null;
  minerReward: number | null;
  nextMinerReward: number | null;
  estimatedDate: string | null;
  estimatedSeconds: number | null;
  currentHeight?: number;
}

export function HalvingPanel({ halving }: { halving: HalvingInfo | null }) {
  if (!halving) return null;

  const progress = halving.eraProgress ?? (
    halving.blocksRemaining != null && halving.halvingBlock
      ? Math.max(0, Math.min(100, ((halving.halvingBlock - (halving.blocksRemaining ?? 0)) / halving.halvingBlock) * 100))
      : 0
  );

  const estDate = halving.estimatedDate
    ? new Date(halving.estimatedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-muted font-mono uppercase tracking-widest opacity-50">{'>'}</span>
          <h2 className="text-sm font-bold font-mono text-secondary uppercase tracking-wider">NEXT_HALVING</h2>
        </div>

        <div className="text-center mb-5">
          <p className="text-3xl sm:text-4xl font-bold font-mono text-primary tabular-nums">
            {halving.blocksRemaining?.toLocaleString() ?? '—'}
          </p>
          <p className="text-[10px] text-muted font-mono mt-1">blocks remaining</p>
        </div>

        <div className="mb-5">
          <div className="flex justify-between text-[10px] text-muted font-mono mb-1.5">
            <span>Current era progress</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 bg-cipher-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cipher-cyan to-cipher-yellow transition-[width] duration-700 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted font-mono">Estimated time</span>
            <span className="text-[11px] font-mono text-primary font-medium">
              ~{halving.estimatedSeconds ? formatDuration(halving.estimatedSeconds) : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted font-mono">Estimated date</span>
            <span className="text-[11px] font-mono text-primary font-medium">{estDate ?? '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted font-mono">Halving block</span>
            <span className="text-[11px] font-mono text-primary font-medium">
              {halving.halvingBlock?.toLocaleString() ?? '—'}
            </span>
          </div>
          <div className="border-t border-cipher-border my-2" />
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted font-mono">Current block subsidy</span>
            <span className="text-[11px] font-mono text-cipher-yellow font-bold">
              {halving.currentSubsidy == null ? '—' : `${halving.currentSubsidy} TWC`}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted font-mono">Next block subsidy</span>
            <span className="text-[11px] font-mono text-cipher-yellow font-bold">
              {halving.nextSubsidy != null ? `${halving.nextSubsidy} TWC` : '—'}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function SupplyEmissionPanel({
  circulating,
  remaining,
  circulatingPct,
  dailyEmission,
  supplyHistory = [],
  maxSupply = 21_000_000,
}: {
  circulating: number;
  remaining: number;
  circulatingPct: number;
  dailyEmission: number | null;
  supplyHistory?: { date: string; circulating: number; height?: number }[];
  maxSupply?: number;
}) {
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const emissionData = supplyHistory.map((point) => ({
    ...point,
    label: new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted font-mono uppercase tracking-widest opacity-50">{'>'}</span>
          <h2 className="text-sm font-bold font-mono text-secondary uppercase tracking-wider">SUPPLY_&amp;_EMISSION</h2>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-[9px] text-muted font-mono uppercase mb-0.5">Circulating</p>
            <p className="text-sm font-bold font-mono text-cipher-yellow tabular-nums">
              {(circulating / 1_000_000).toFixed(2)}M TWC
            </p>
            <p className="text-[9px] text-muted font-mono">{circulatingPct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[9px] text-muted font-mono uppercase mb-0.5">Remaining</p>
            <p className="text-sm font-bold font-mono text-secondary tabular-nums">
              {(remaining / 1_000_000).toFixed(2)}M TWC
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted font-mono uppercase mb-0.5">Daily Emission</p>
            <p className="text-sm font-bold font-mono text-primary tabular-nums">
              ~{dailyEmission != null ? `${dailyEmission.toFixed(2)}` : '—'} TWC
            </p>
          </div>
        </div>

        <div className="h-[180px]">
          {emissionData.length < 2 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted text-center px-6">
              Supply history will appear after the WcashExplorer snapshot job records two canonical observations.
            </div>
          ) : (
          <ResponsiveContainer initialDimension={{ width: 500, height: 300 }} width="100%" height="100%">
            <AreaChart data={emissionData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="emissionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5B9CF6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#5B9CF6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke={colors.axis}
                tick={{ fill: colors.axis, fontSize: 9 }}
                interval={7}
                tickLine={false}
              />
              <YAxis
                stroke={colors.axis}
                tick={{ fill: colors.axis, fontSize: 9 }}
                tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`}
                domain={[0, 21_000_000]}
                tickLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
                itemStyle={{ color: colors.tooltipText }}
                labelStyle={{ color: colors.tooltipText }}
                formatter={(value) => [`${(Number(value) / 1_000_000).toFixed(2)}M TWC`, 'Supply']}
              />
              <Area
                type="monotone"
                dataKey="circulating"
                stroke="#5B9CF6"
                strokeWidth={2}
                fill="url(#emissionGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        <p className="text-[9px] text-muted font-mono text-center mt-2">
          21M TWC cap · subsidy halves every 1,680,000 blocks · observed history only
        </p>
      </CardBody>
    </Card>
  );
}
