'use client';

import { useApiQuery } from '@/hooks/useApiQuery';
import { PageHeader, SectionHeader } from '@/components/ui';
import { Card, CardBody } from '@/components/ui/Card';
import { CURRENCY } from '@/lib/config';

interface IronwoodOverview {
  success: boolean;
  network: string;
  ticker: string;
  activationHeight: number;
  pool: {
    chainValue?: number | string | null;
    chainValueZat?: number | string | null;
    monitored?: boolean | null;
  } | null;
  indexed: {
    height: number;
    ironwoodTransactions: number;
    ironwoodActions: number;
    latestActivityHeight: number | null;
  };
  node: { height: number | null } | null;
  source: { activity: string; poolBalance: string };
}

function twc(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export default function IronwoodPage() {
  const query = useApiQuery<IronwoodOverview>('/api/ironwood/overview', undefined, {
    refreshInterval: 30_000,
  });
  const data = query.data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <PageHeader
        eyebrow="WCASH / IRONWOOD"
        title="W.cash Ironwood"
        subtitle="The W.cash shielded value pool, tracked from Wolf consensus data and the WcashExplorer indexer."
      />

      {query.loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="card h-28 animate-pulse" />)}
        </div>
      ) : !data ? (
        <Card>
          <CardBody className="py-14 text-center">
            <p className="text-sm text-primary">Ironwood data is not available yet.</p>
            <p className="mt-2 text-xs text-muted">Start the W.cash API, Wolf, PostgreSQL, and the indexer, then retry.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Ironwood pool" value={`${twc(data.pool?.chainValue)} ${CURRENCY}`} />
            <Metric label="Indexed height" value={`#${data.indexed.height.toLocaleString()}`} />
            <Metric label="Ironwood TXs" value={data.indexed.ironwoodTransactions.toLocaleString()} />
            <Metric label="Ironwood actions" value={data.indexed.ironwoodActions.toLocaleString()} />
          </div>

          <Card className="mt-8">
            <CardBody>
              <SectionHeader label="IRONWOOD_PROFILE" />
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <Detail label="Activation height" value={`#${data.activationHeight}`} />
                <Detail label="Latest indexed activity" value={data.indexed.latestActivityHeight == null ? 'None yet' : `#${data.indexed.latestActivityHeight.toLocaleString()}`} />
                <Detail label="Wolf node height" value={data.node?.height == null ? 'Unavailable' : `#${data.node.height.toLocaleString()}`} />
                <Detail label="Pool monitored" value={data.pool?.monitored == null ? 'Not reported' : data.pool.monitored ? 'Yes' : 'No'} />
                <Detail label="Activity source" value="WcashExplorer PostgreSQL index" />
                <Detail label="Pool balance source" value={data.source.poolBalance} />
              </dl>
            </CardBody>
          </Card>

          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted">
            Individual shielded balances remain private. This page shows only the aggregate
            Ironwood pool balance returned by Wolf and public transaction/action counts indexed
            by WcashExplorer; wallet scanning and broadcasting are intentionally disabled until their
            W.cash-compatible implementations are independently verified.
          </p>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="compact">
      <CardBody>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted">{label}</div>
        <div className="mt-2 text-lg font-bold font-mono text-primary tabular-nums">{value}</div>
      </CardBody>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-mono uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-secondary break-words">{value}</dd>
    </div>
  );
}
