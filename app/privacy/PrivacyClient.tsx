'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getApiUrl } from '@/lib/api-config';
import { PageHeader, SectionHeader } from '@/components/ui';
import { Card, CardBody } from '@/components/ui/Card';
import { PageSectionNav } from '@/components/PageSectionNav';

type Daily = { date: string; shielded: number; transparent: number; shieldedPercentage: number; poolSize: number; privacyScore: number };
type Stats = { lastUpdated: string; lastBlockScanned: number; totals: { blocks: number; shieldedTx: number; transparentTx: number; coinbaseTx: number; totalTx: number; mixedTx: number; fullyShieldedTx: number }; shieldedPool: { currentSize: number; ironwood: number; transparent: number; chainSupply: number }; metrics: { shieldedPercentage: number; privacyScore: number; avgShieldedPerDay: number; adoptionTrend: string }; trends: { daily: Daily[] } };

function format(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

function TrendChart({ data }: { data: Daily[] }) {
  if (!data.length) return <div className="h-72 flex items-center justify-center text-sm text-muted font-mono">No indexed W.cash history yet.</div>;
  return <ResponsiveContainer width="100%" height={290}><AreaChart data={data}><CartesianGrid strokeDasharray="2 6" stroke="#1e293b" opacity={0.6} /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(value) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' })} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} /><Tooltip contentStyle={{ backgroundColor: '#0f1419', border: '1px solid #1e293b', fontFamily: 'monospace', fontSize: 11 }} /><Area type="monotone" dataKey="shielded" name="Ironwood txs" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.18} /><Area type="monotone" dataKey="transparent" name="Transparent txs" stroke="#56D4C8" fill="#56D4C8" fillOpacity={0.12} /></AreaChart></ResponsiveContainer>;
}

export default function PrivacyClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch(`${getApiUrl()}/api/privacy-stats?days=1000`).then((response) => response.ok ? response.json() : null).then((data) => { if (data && !data.error) setStats(data); }).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-12"><PageHeader eyebrow="WCASH ACTIVITY" title="Ironwood activity" subtitle="Public W.cash Testnet privacy/activity metrics." /><div className="py-20 text-center text-sm font-mono text-muted">Loading indexed data…</div></div>;
  if (!stats) return <div className="max-w-7xl mx-auto px-4 py-12"><Card><CardBody className="py-16 text-center"><h1 className="text-xl font-bold text-primary mb-3">W.cash activity is not available yet</h1><p className="text-sm text-secondary">Start the Wolf → indexer → PostgreSQL → API pipeline, then refresh this page.</p></CardBody></Card></div>;

  const metrics = [
    ['Indexed blocks', format(stats.totals.blocks, 0)], ['All transactions', format(stats.totals.totalTx, 0)], ['Ironwood transactions', format(stats.totals.shieldedTx, 0)],
    ['Ironwood balance', `${format(stats.shieldedPool.ironwood)} TWC`], ['Transparent balance', `${format(stats.shieldedPool.transparent)} TWC`], ['Activity share', `${format(stats.metrics.shieldedPercentage, 1)}%`],
  ];
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <PageHeader eyebrow="WCASH ACTIVITY" title="Ironwood activity" subtitle="Observed W.cash Testnet usage, value-pool balances, and amount distributions." actions={<div className="text-right font-mono"><div className="text-4xl font-bold text-primary">{stats.metrics.privacyScore}</div><div className="text-[10px] text-muted uppercase">activity index / 100</div></div>} />
    <PageSectionNav sections={[{ id: 'summary', label: 'Summary' }, { id: 'trends', label: 'Trends' }, { id: 'distribution', label: 'Distribution' }]} ariaLabel="W.cash activity sections" />
    <section id="summary" className="scroll-mt-36 mb-12"><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{metrics.map(([labelText, value]) => <Card key={labelText}><CardBody className="py-3"><div className="text-[10px] text-muted font-mono uppercase mb-1">{labelText}</div><div className="text-lg font-bold font-mono text-primary tabular-nums">{value}</div></CardBody></Card>)}</div><p className="mt-3 text-[10px] text-muted font-mono">Last indexed block {stats.lastBlockScanned.toLocaleString()} · updated {new Date(stats.lastUpdated).toLocaleString()} · trend: {stats.metrics.adoptionTrend}</p></section>
    <section id="trends" className="scroll-mt-36 mb-12"><SectionHeader label="DAILY IRONWOOD / TRANSPARENT ACTIVITY" /><Card><CardBody><TrendChart data={stats.trends.daily} /></CardBody></Card></section>
    <section id="distribution" className="scroll-mt-36 mb-12"><SectionHeader label="PUBLIC ACTIVITY ANALYTICS" /><div className="grid gap-4 sm:grid-cols-3"><Link href="/charts" className="group rounded-xl border border-cipher-border bg-cipher-surface p-5 hover:border-cipher-cyan/40"><div className="text-sm font-semibold text-primary group-hover:text-cipher-cyan">Amount activity counts →</div><p className="mt-2 text-xs text-muted">Threshold counts from observed Ironwood flows.</p></Link><Link href="/pools" className="group rounded-xl border border-cipher-border bg-cipher-surface p-5 hover:border-cipher-cyan/40"><div className="text-sm font-semibold text-primary group-hover:text-cipher-cyan">Value pools →</div><p className="mt-2 text-xs text-muted">Transparent and Ironwood balances in TWC.</p></Link><Link href="/privacy-risks" className="group rounded-xl border border-cipher-border bg-cipher-surface p-5 hover:border-cipher-cyan/40"><div className="text-sm font-semibold text-primary group-hover:text-cipher-cyan">Heuristic observations →</div><p className="mt-2 text-xs text-muted">Amount/time similarities with no private recipient inference.</p></Link></div></section>
  </div>;
}
