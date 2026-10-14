'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api-config';
import { PageHeader, SectionHeader } from '@/components/ui';
import { PageSectionNav } from '@/components/PageSectionNav';
import { PoolDistributionChart } from '@/components/network/PoolDistributionChart';
import { FlowVolumeChart } from '@/components/pools/FlowVolumeChart';
import { FlowLegend } from '@/components/pools/FlowLegend';
import {
  PoolOverviewHero,
  PoolOverviewSkeleton,
  type PoolOverviewData,
} from '@/components/pools/PoolOverviewHero';
import { Card, CardBody } from '@/components/ui/Card';
import { DataTable } from '@/components/ui';
import { ShieldFlowBadge } from '@/components/ShieldFlowBadge';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'supply', label: 'Supply' },
  { id: 'flows', label: 'Flows' },
] as const;

interface RecentFlow {
  txid: string;
  flowType: string;
  amountTwc: number;
  pool: string;
  blockTime: number;
}

function formatTimeAgo(unixSec: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function RecentLargeFlows() {
  const [flows, setFlows] = useState<RecentFlow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    fetch(`${getApiUrl()}/api/shielded/list?limit=10&min_twc=10`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const source = data?.flows || data?.data;
        if (Array.isArray(source)) {
          setFlows(source.map((flow: any) => ({
            ...flow,
            amountTwc: flow.amountTwc ?? 0,
          })));
        }
        setStatus(data ? 'ready' : 'unavailable');
      })
      .catch(() => setStatus('unavailable'));
  }, []);

  if (status === 'loading' || (status === 'ready' && flows.length === 0)) return null;

  if (status === 'unavailable') {
    return (
      <Card variant="glass">
        <CardBody>
          <p className="text-xs text-muted font-mono" role="status">
            Recent large-flow data is temporarily unavailable.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card variant="glass">
      <CardBody>
        <SectionHeader
          label="RECENT_LARGE_FLOWS"
          actions={
            <Link href="/txs?type=shielded" className="text-[10px] font-mono text-cipher-cyan hover:underline">
              View all →
            </Link>
          }
        />
        <DataTable
          bare
          columns={[
            {
              id: 'type',
              header: 'Type',
              cell: (f: RecentFlow) => (
                <ShieldFlowBadge type={f.flowType === 'shield' ? 'shielding' : 'unshielding'} variant="full" />
              ),
            },
            {
              id: 'pool',
              header: 'Pool',
              cell: (f) => <span className="font-mono text-xs text-muted capitalize">{f.pool}</span>,
            },
            {
              id: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (f) => (
                <span className="font-mono text-xs tabular-nums text-primary">
                  {(f.amountTwc || 0).toFixed(2)} TWC
                </span>
              ),
            },
            {
              id: 'time',
              header: 'Time',
              align: 'right',
              cell: (f) => (
                <span className="font-mono text-xs text-muted">
                  {f.blockTime ? formatTimeAgo(f.blockTime) : '—'}
                </span>
              ),
            },
          ]}
          rows={flows}
          rowKey={(f, i) => `${f.txid}-${i}`}
        />
        <FlowLegend className="mt-4 border-t border-glass-4 pt-4" />
      </CardBody>
    </Card>
  );
}

export default function PoolsPage() {
  const [overview, setOverview] = useState<PoolOverviewData | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    fetch(`${getApiUrl()}/api/pools/overview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.current) {
          setOverview(data);
          setOverviewStatus('ready');
        } else {
          setOverviewStatus('unavailable');
        }
      })
      .catch(() => setOverviewStatus('unavailable'));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <PageHeader
        eyebrow="WCASH_VALUE_POOLS"
        title="W.cash Value Pools"
        subtitle="Track public and Ironwood value-pool balances and the transparent-to-shielded flow recorded by WcashExplorer."
      />

      <PageSectionNav sections={SECTIONS} ariaLabel="Pool analytics sections" className="mb-10" />

      <section id="overview" className="scroll-mt-36 mb-14">
        {overviewStatus === 'loading' ? (
          <PoolOverviewSkeleton />
        ) : overviewStatus === 'ready' && overview ? (
          <PoolOverviewHero data={overview} />
        ) : (
          <Card variant="glass">
            <CardBody>
              <p className="py-12 text-center text-xs text-muted font-mono" role="status">
                Shielded-pool overview data is temporarily unavailable.
              </p>
            </CardBody>
          </Card>
        )}
      </section>

      <section id="supply-definitions" className="scroll-mt-36 mb-14 text-sm text-secondary">
        <h2 className="mb-2 font-semibold text-primary">Supply definitions</h2>
        <p>
          The map partitions the W.cash monetary ceiling into transparent supply, the Ironwood pool,
          and remaining issuance. Unmined is the 21M cap minus the current issued chain supply.
          The public segment is the issued remainder after the aggregate Ironwood pool; it does not
          reveal individual private balances.
        </p>
        <p className="mt-2">
          Balances come from stored node snapshots and are not refreshed on every block. The timeline
          excludes records with missing or inconsistent supply totals; it does not substitute current
          supply for historical data. Public pool aggregates do not reveal individual shielded balances.
        </p>
      </section>

      <section id="supply" className="scroll-mt-36 mb-14">
        <PoolDistributionChart />
      </section>

      <section id="flows" className="scroll-mt-36 mb-14">
        <FlowVolumeChart />
      </section>

      <section className="mb-14">
        <RecentLargeFlows />
      </section>
    </div>
  );
}
