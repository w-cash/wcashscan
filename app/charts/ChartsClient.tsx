'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { getApiUrl } from '@/lib/api-config';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Category = 'all' | 'privacy' | 'pools' | 'mining' | 'network' | 'fees';
type MiniChartData = Record<string, number | string>;
type ChartEntry = { id: string; title: string; description: string; category: Exclude<Category, 'all'>; href: string; isNew?: boolean };

const CHART_DEFS: ChartEntry[] = [
  { id: 'privacy-adoption', title: 'Ironwood Activity Share', description: 'Daily share of indexed non-coinbase transactions containing Ironwood actions.', category: 'privacy', href: '/privacy' },
  { id: 'pool-growth', title: 'Ironwood Pool Growth', description: 'Observed Ironwood balance from W.cash node/indexed snapshots, in TWC.', category: 'privacy', href: '/privacy' },
  { id: 'daily-activity', title: 'Daily Activity', description: 'Indexed non-coinbase Ironwood and transparent transaction counts.', category: 'privacy', href: '/privacy' },
  { id: 'anonymity-set', title: 'Amount Activity Counts', description: 'Observed Ironwood shield/deshield counts at each TWC threshold; not identity inference.', category: 'privacy', href: '/privacy', isNew: true },
  { id: 'shielding-dist', title: 'Ironwood Flow Distribution', description: 'Observed shield and deshield volume by TWC bucket.', category: 'privacy', href: '/privacy', isNew: true },
  { id: 'pool-balances', title: 'Value Pool Balances', description: 'Transparent and Ironwood balances from W.cash snapshots.', category: 'pools', href: '/pools' },
  { id: 'flow-volume', title: 'Ironwood Flow Volume', description: 'Daily observed shielding and deshielding volume in TWC.', category: 'pools', href: '/pools' },
  { id: 'flow-observations', title: 'Flow Observations', description: 'Observed Ironwood flow totals; private recipients and destinations are unknown.', category: 'pools', href: '/pools' },
  { id: 'mining-dist', title: 'Miner Distribution', description: 'W.cash blocks grouped by verified operator attribution or Unknown.', category: 'mining', href: '/mining' },
  { id: 'hashrate-share', title: 'Miner Block Share', description: 'Daily block share from indexed W.cash blocks.', category: 'mining', href: '/mining' },
  { id: 'miner-behavior', title: 'Coinbase Movement', description: 'Observed mined-output movement versus held output, when the job has coverage.', category: 'mining', href: '/mining' },
  { id: 'network-hashrate', title: 'W.cash Solution Rate', description: 'Wolf getnetworksolps samples in Sol/s.', category: 'mining', href: '/mining', isNew: true },
  { id: 'supply-emission', title: 'Supply Emission', description: 'Observed circulating TWC history toward the 21M monetary ceiling.', category: 'network', href: '/network' },
  { id: 'chain-size', title: 'Serialized Chain Size', description: 'Exact sum of indexed serialized block bytes; not node disk usage.', category: 'network', href: '/network' },
  { id: 'protocol-stats', title: 'Ironwood Actions', description: 'Indexed Ironwood action count over time.', category: 'network', href: '/network' },
  { id: 'fee-dist', title: 'Fee Distribution', description: 'Daily transaction fee median in TWC; raw API values remain zatoshi.', category: 'fees', href: '/network', isNew: true },
];

const LIVE_VIZ_DEFS = [
  { id: 'node-map', title: 'Observed Peers', description: 'Coarse W.cash peer locations from the optional node observer.', href: '/network' },
  { id: 'mempool', title: 'Mempool Activity', description: 'Live unconfirmed W.cash transactions from Wolf.', href: '/mempool' },
  { id: 'privacy-risks', title: 'Privacy Heuristics', description: 'W.cash pattern observations with explicit coverage labels.', href: '/privacy-risks' },
];

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'privacy', label: 'Privacy' }, { key: 'pools', label: 'Pools' },
  { key: 'mining', label: 'Mining' }, { key: 'network', label: 'Network' }, { key: 'fees', label: 'Fees' },
];

const CATEGORY_ACCENT: Record<string, string> = { privacy: '#a78bfa', pools: '#56D4C8', mining: '#E8C48D', network: '#5B9CF6', fees: '#f97316' };

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1) return value.toFixed(1);
  return value === 0 ? '0' : value.toFixed(3);
}

function MiniChart({ data, dataKey, color, type }: { data: MiniChartData[]; dataKey: string; color: string; type: 'line' | 'area' | 'bar' }) {
  if (!data?.length) return <div className="h-full flex items-center justify-center text-[10px] text-muted/40 font-mono">No W.cash data yet</div>;
  const axis = { tick: { fontSize: 9, fill: '#64748b' }, tickLine: false, axisLine: false };
  const grid = { strokeDasharray: '3 3', stroke: '#1e293b', vertical: false };
  const tooltip = { contentStyle: { backgroundColor: '#0f1419', border: '1px solid #1e293b', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }, itemStyle: { color: '#e2e8f0' } };
  const chart = type === 'bar' ? <BarChart data={data} margin={{ top: 8, right: 8, bottom: 20, left: 30 }}><CartesianGrid {...grid} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={compact} width={32} /><Tooltip {...tooltip} /><Bar dataKey={dataKey} fill={color} opacity={0.8} /></BarChart>
    : type === 'area' ? <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 20, left: 30 }}><CartesianGrid {...grid} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={compact} width={32} /><Tooltip {...tooltip} /><defs><linearGradient id={`wcash-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.25} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#wcash-${dataKey})`} strokeWidth={1.5} dot={false} /></AreaChart>
    : <LineChart data={data} margin={{ top: 8, right: 8, bottom: 20, left: 30 }}><CartesianGrid {...grid} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={compact} width={32} /><Tooltip {...tooltip} /><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} /></LineChart>;
  return <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>;
}

function config(id: string): { key: string; type: 'line' | 'area' | 'bar' } {
  const map: Record<string, { key: string; type: 'line' | 'area' | 'bar' }> = {
    'privacy-adoption': { key: 'shieldedPct', type: 'line' }, 'pool-growth': { key: 'ironwood', type: 'area' }, 'daily-activity': { key: 'shielded', type: 'bar' },
    'anonymity-set': { key: 'shieldCount', type: 'bar' }, 'shielding-dist': { key: 'count', type: 'bar' }, 'pool-balances': { key: 'ironwood', type: 'area' },
    'flow-volume': { key: 'net', type: 'bar' }, 'flow-observations': { key: 'deshielded', type: 'area' }, 'mining-dist': { key: 'blocks', type: 'bar' },
    'hashrate-share': { key: 'share', type: 'area' }, 'miner-behavior': { key: 'moved', type: 'bar' }, 'network-hashrate': { key: 'hashrate', type: 'line' },
    'supply-emission': { key: 'supply', type: 'area' }, 'chain-size': { key: 'sizeGb', type: 'line' }, 'protocol-stats': { key: 'actions', type: 'area' }, 'fee-dist': { key: 'median', type: 'line' },
  };
  return map[id] || { key: 'value', type: 'line' };
}

function ChartCard({ chart, data, color }: { chart: ChartEntry; data: MiniChartData[] | null; color: string }) {
  const chartConfig = config(chart.id);
  return <Link href={chart.href} className="group block rounded-xl border border-cipher-border/40 bg-cipher-surface overflow-hidden hover:border-white/15 transition">
    <div className="px-4 pt-4 pb-2 flex items-center justify-between"><h3 className="text-[11px] font-bold font-mono text-secondary group-hover:text-primary uppercase tracking-wider truncate">{chart.title}</h3>{chart.isNew && <span className="px-1 py-0.5 rounded text-[8px] font-mono bg-cipher-green/10 text-cipher-green uppercase">New</span>}</div>
    <div className="h-[180px] px-2 pb-3"><MiniChart data={data || []} dataKey={chartConfig.key} color={color} type={chartConfig.type} /></div>
    <div className="px-4 pb-3 border-t border-cipher-border/20 pt-2"><p className="text-[10px] text-muted line-clamp-2">{chart.description}</p></div>
  </Link>;
}

function ObservedPeersViz() {
  const [locations, setLocations] = useState<{ nodeCount: number }[]>([]);
  useEffect(() => { fetch(`${getApiUrl()}/api/network/nodes`).then((r) => r.ok ? r.json() : null).then((data) => setLocations(data?.locations || [])).catch(() => {}); }, []);
  return <div className="h-full w-full bg-cipher-bg-dark p-5 grid grid-cols-6 gap-2 content-center">{locations.slice(0, 30).map((location, index) => <span key={index} title={`${location.nodeCount} observed peers`} className="rounded-full bg-cipher-yellow/70" style={{ width: `${Math.min(22, 5 + location.nodeCount * 2)}px`, height: `${Math.min(22, 5 + location.nodeCount * 2)}px` }} />)}{!locations.length && <span className="col-span-6 text-center text-[10px] text-white/35 font-mono">No peer observation data</span>}</div>;
}

function MempoolViz() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { fetch(`${getApiUrl()}/api/mempool`).then((r) => r.ok ? r.json() : null).then((data) => setCount(Number(data?.count || 0))).catch(() => setCount(null)); }, []);
  return <div className="h-full flex items-center justify-center bg-cipher-bg-dark"><div className="text-center"><div className="text-4xl font-mono text-cipher-cyan">{count == null ? '—' : count}</div><div className="text-[9px] font-mono text-white/40 uppercase mt-2">pending W.cash transactions</div></div></div>;
}

function ActivityViz({ summary }: { summary: ActivitySummary }) {
  return <div className="h-full flex items-center justify-center bg-cipher-bg-dark"><div className="grid grid-cols-2 gap-x-8 gap-y-3 text-center font-mono"><div><div className="text-2xl text-emerald-400">{summary.up}</div><div className="text-[9px] text-white/40 uppercase">activity up</div></div><div><div className="text-2xl text-amber-400">{summary.down}</div><div className="text-[9px] text-white/40 uppercase">activity down</div></div><div className="col-span-2 text-[9px] text-white/35">7-day indexed anomaly window</div></div></div>;
}

type ActivitySummary = { up: number; down: number; high: number; medium: number; low: number; total: number };

function LivePreview({ id, summary }: { id: string; summary: ActivitySummary }) {
  if (id === 'node-map') return <ObservedPeersViz />;
  if (id === 'mempool') return <MempoolViz />;
  if (id === 'privacy-risks') return <div className="h-full flex items-center justify-center bg-cipher-bg-dark"><div className="text-center font-mono"><div className="text-3xl text-cipher-purple">{summary.total}</div><div className="text-[9px] text-white/40 uppercase mt-2">W.cash observations</div><div className="text-[9px] text-white/30 mt-1">heuristic coverage only</div></div></div>;
  return <ActivityViz summary={summary} />;
}

export function ChartsClient({ initialData, activitySummary }: { initialData: Record<string, MiniChartData[]>; activitySummary: ActivitySummary }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const filtered = useMemo(() => CHART_DEFS.filter((chart) => (category === 'all' || chart.category === category) && (!search.trim() || `${chart.title} ${chart.description}`.toLowerCase().includes(search.toLowerCase()))), [category, search]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((item) => [item.key, item.key === 'all' ? CHART_DEFS.length : CHART_DEFS.filter((chart) => chart.category === item.key).length])), []);
  const sections = category === 'all' && !search.trim() ? (['privacy', 'pools', 'mining', 'network', 'fees'] as const) : [];
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <PageHeader eyebrow="WCASH CHARTS" title="Charts & Analytics" subtitle="Every retained chart is backed by indexed W.cash data or shows an explicit empty/partial state." />
    <div className="flex flex-col sm:flex-row gap-3 mb-8"><input aria-label="Search charts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search W.cash charts..." className="flex-1 max-w-sm px-3 py-2 text-sm font-mono bg-glass-3 border border-cipher-border rounded-lg text-primary focus:outline-none" /><div className="inline-flex gap-0 p-0.5 rounded-lg bg-glass-3 overflow-x-auto">{CATEGORIES.map((item) => <button key={item.key} onClick={() => setCategory(item.key)} className={`px-3 py-1.5 text-[11px] font-mono rounded-md whitespace-nowrap ${category === item.key ? 'bg-white/5 text-primary font-bold' : 'text-muted hover:text-secondary'}`}>{item.label}<span className="ml-1 opacity-40">{counts[item.key]}</span></button>)}</div></div>
    {sections.length ? <div className="space-y-12">{sections.map((section) => { const charts = CHART_DEFS.filter((chart) => chart.category === section); return <section key={section}><div className="flex items-center gap-3 mb-5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_ACCENT[section] }} /><h2 className="text-sm font-bold font-mono text-secondary uppercase tracking-wider">{section}</h2><span className="flex-1 h-px bg-cipher-border/30" /><span className="text-[10px] text-muted font-mono">{charts.length} charts</span></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{charts.map((chart) => <ChartCard key={chart.id} chart={chart} data={initialData[chart.id] || null} color={CATEGORY_ACCENT[section]} />)}</div></section>; })}</div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map((chart) => <ChartCard key={chart.id} chart={chart} data={initialData[chart.id] || null} color={CATEGORY_ACCENT[chart.category]} />)}</div>}
    {!filtered.length && <div className="mt-12 py-16 text-center rounded-xl border border-cipher-border/30 bg-cipher-surface text-secondary text-sm">No charts match this filter.</div>}
    {category === 'all' && !search.trim() && <section className="mt-12"><div className="flex items-center gap-3 mb-5"><span className="w-2 h-2 rounded-full bg-emerald-400" /><h2 className="text-sm font-bold font-mono text-secondary uppercase tracking-wider">Live Observations</h2><span className="flex-1 h-px bg-cipher-border/30" /></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{LIVE_VIZ_DEFS.map((item) => <Link key={item.id} href={item.href} className="group block rounded-xl border border-cipher-border/40 bg-cipher-surface overflow-hidden hover:border-emerald-400/30 transition"><div className="h-[180px] pointer-events-none"><LivePreview id={item.id} summary={activitySummary} /></div><div className="px-4 pb-3 border-t border-cipher-border/20 pt-2"><h3 className="text-[11px] font-bold font-mono text-secondary group-hover:text-primary uppercase tracking-wider">{item.title}</h3><p className="text-[10px] text-muted mt-0.5">{item.description}</p></div></Link>)}</div></section>}
    <p className="mt-14 text-center text-[10px] text-muted/50 font-mono">Data refreshes every five minutes. Units are TWC unless a card says Sol/s or displays raw zatoshi.</p>
  </div>;
}
