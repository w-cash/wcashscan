import { forwardRef } from 'react';
import { Badge, DataTable, HashLink, RedactedAmount, TxTypeBadge, type DataTableColumn, type TxCategory } from '@/components/ui';
import { StakingActionBadge } from '@/components/StakingActionBadge';
import { zatToTwc } from '@/lib/format-numbers';
import { CURRENCY } from '@/lib/config';
import type { BlockData } from './types';

/** Same category registry as every other Type column in the app — see TxTypeBadge. */
function poolBadge(tx: any) {
  if (tx.staking_action_type) return <StakingActionBadge type={tx.staking_action_type} compact />;
  const category: TxCategory = tx.vin?.[0]?.coinbase
    ? 'coinbase'
      : tx.has_ironwood ? 'ironwood' : 'transparent';
  return <TxTypeBadge category={category} />;
}

/** Ironwood pool label -> the same category TxTypeBadge uses elsewhere. */
function poolLabelCategory(pool: string): TxCategory {
  return pool === 'Ironwood' ? 'ironwood' : 'transparent';
}

function poolBalances(tx: any) {
  return {
    irn: parseInt(tx.value_balance_ironwood || 0),
  };
}

function sourcePoolLabel(tx: any): string | null {
  const { irn } = poolBalances(tx);
  if (irn > 0) return 'Ironwood';
  return null;
}

function hasTransparentOutput(tx: any): boolean {
  return (tx.vout || []).some((o: any) => (o.value || 0) > 0);
}

/**
 * The "destination" output for display — not always vout[0]. Some
 * transactions carry a zero-value, no-address output before the real
 * recipient (e.g. an empty/OP_RETURN-style output), and vout[0] alone can
 * land on that placeholder instead of the actual recipient, making a normal
 * transfer render as if it had no destination at all.
 */
function firstOutputAddress(tx: any): string | undefined {
  return (tx.vout || []).find((o: any) => o.scriptPubKey?.addresses?.[0])?.scriptPubKey?.addresses?.[0];
}

function destPoolLabel(tx: any): string | null {
  const { irn } = poolBalances(tx);
  if (irn < 0) return 'Ironwood';

  // No pool shows a net arrival and no transparent output exists either —
  // by the binding-signature balance equation (public, even for fully-shielded
  // txs), whatever nominally "left" the source pool can only have covered the
  // fee. It never actually left the pool: a self-contained spend-and-return,
  // not an unknown destination, so show the source pool as the destination
  // too rather than "—" (which reads as "hidden/unknown").
  if (!hasTransparentOutput(tx)) {
    const source = sourcePoolLabel(tx);
    if (source) return source;
  }
  return null;
}

/**
 * The transparent-side value balance is public consensus data (needed for
 * the binding-signature balance equation), not a private spend — same rule
 * as the tx-detail and homepage tables. A fully-shielded tx has genuinely no
 * known amount and gets RedactedAmount instead of a fabricated number.
 *
 * The only native private pool is Ironwood. A transparent-side value balance
 * is public consensus data; a pure Ironwood transaction remains redacted.
 */
function knownAmount(tx: any): number | null {
  const isCoinbase = Boolean(tx.vin?.[0]?.coinbase);
  const transparentOut = (tx.vout || []).reduce((sum: number, o: any) => sum + (o.value || 0), 0);
  const { irn } = poolBalances(tx);
  const shieldedDeposit = irn < 0 ? zatToTwc(Math.abs(irn)) : 0;
  const total = transparentOut + shieldedDeposit;
  if (total > 0) return total;
  if (isCoinbase) return total; // legitimately zero
  return null;
}

const columns: DataTableColumn<any>[] = [
  {
    id: 'index',
    header: '#',
    skeletonWidth: 'w-4',
    cell: (_tx, i) => <span className="text-xs font-mono text-muted tabular-nums">{i + 1}</span>,
  },
  {
    id: 'type',
    header: 'Type',
    skeletonWidth: 'w-16',
    cell: (tx) => poolBadge(tx),
  },
  {
    id: 'hash',
    header: 'Hash',
    skeletonWidth: 'w-28',
    cell: (tx) => <HashLink value={tx.txid} href={`/tx/${tx.txid}`} lead={10} tail={6} responsive copy={false} />,
  },
  {
    id: 'from',
    header: 'From',
    skeletonWidth: 'w-24',
    cell: (tx) => {
      const isCoinbase = Boolean(tx.vin?.[0]?.coinbase);
      const fromAddress = !isCoinbase && tx.vin?.[0]?.address;
      if (isCoinbase) return <span className="text-xs text-muted font-mono">Block Reward</span>;
      if (fromAddress) return <HashLink value={fromAddress} href={`/address/${fromAddress}`} copy={false} lead={8} tail={4} responsive />;
      const label = sourcePoolLabel(tx);
      if (label) return <TxTypeBadge category={poolLabelCategory(label)} label={label} />;
      return <span className="text-xs text-muted font-mono">—</span>;
    },
  },
  {
    id: 'to',
    header: 'To',
    skeletonWidth: 'w-24',
    cell: (tx) => {
      const isCoinbase = Boolean(tx.vin?.[0]?.coinbase);
      const toAddress = firstOutputAddress(tx);
      const poolLabel = destPoolLabel(tx);

      // A coinbase can have both transparent and shielded recipients. Do not
      // pick the larger one: that makes the row look like the whole displayed
      // value went to a single recipient. Keep the table compact while making
      // the additional recipient explicit; the detail card has the amounts.
      if (isCoinbase && toAddress && poolLabel) {
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <TxTypeBadge category={poolLabelCategory(poolLabel)} label={poolLabel} />
            <span className="text-[10px] text-muted">+ funding stream</span>
          </span>
        );
      }

      if (toAddress) return <HashLink value={toAddress} href={`/address/${toAddress}`} copy={false} lead={8} tail={4} responsive />;
      if (poolLabel) return <TxTypeBadge category={poolLabelCategory(poolLabel)} label={poolLabel} />;
      return <span className="text-xs text-muted font-mono">—</span>;
    },
  },
  {
    id: 'ins',
    header: 'Ins',
    align: 'center',
    skeletonWidth: 'w-4',
    cell: (tx) => {
      const isCoinbase = Boolean(tx.vin?.[0]?.coinbase);
      if (isCoinbase) return <span className="text-xs font-mono text-secondary tabular-nums">0</span>;
      const transparentIns = tx.vin?.length || 0;
      const shieldedIns = tx.ironwood_actions || 0;
      const total = transparentIns + shieldedIns;
      return <span className="text-xs font-mono text-secondary tabular-nums">{total}</span>;
    },
  },
  {
    id: 'outs',
    header: 'Outs',
    align: 'center',
    skeletonWidth: 'w-4',
    cell: (tx) => {
      const transparentOuts = tx.vout?.length || 0;
      const shieldedOuts = tx.ironwood_actions || 0;
      const total = transparentOuts + shieldedOuts;
      return <span className="text-xs font-mono text-secondary tabular-nums">{total}</span>;
    },
  },
  {
    id: 'value',
    header: `Value (${CURRENCY})`,
    align: 'right',
    skeletonWidth: 'w-16',
    cell: (tx) => {
      const amount = knownAmount(tx);
      if (amount === null) return <RedactedAmount className="!text-xs" />;
      return <span className="text-xs font-mono text-primary font-semibold tabular-nums">{amount.toFixed(4)}</span>;
    },
  },
  {
    id: 'fee',
    header: 'Fee',
    align: 'right',
    skeletonWidth: 'w-12',
    cell: (tx) => {
      if (tx.vin?.[0]?.coinbase) return <span className="text-xs text-muted">—</span>;
      const feeZat = parseInt(tx.fee || 0);
      if (feeZat === 0) return <span className="text-xs text-muted">—</span>;
      if (feeZat === 10000) return <span className="text-[10px] text-muted font-mono">Standard</span>;
      const feeTwc = zatToTwc(feeZat);
      return (
        <span className="text-[10px] text-muted font-mono tabular-nums">
          {feeTwc < 0.001 ? feeTwc.toFixed(5) : feeTwc.toFixed(4)} TWC
        </span>
      );
    },
  },
];

export const BlockTransactionsSection = forwardRef<HTMLDivElement, { data: BlockData }>(
  function BlockTransactionsSection({ data }, ref) {
    if (data.isOrphaned) return null;

    return (
      <div ref={ref}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">Transactions</h2>
          <Badge color="muted">{data.transactionCount}</Badge>
        </div>
        <DataTable
          columns={columns}
          rows={data.transactions || []}
          rowKey={(tx, i) => tx.txid || i}
          empty={<p className="text-center py-12 text-secondary font-mono text-sm">No transaction details available</p>}
        />
      </div>
    );
  },
);
