'use client';

import Link from 'next/link';
import { CURRENCY } from '@/lib/config';
import { Card, CardBody } from '@/components/ui/Card';
import { HashLink } from '@/components/ui/HashLink';
import { FactBox, CopyableHash } from '@/components/ui/FactBox';
import { TxTypeBadge, type TxCategory } from '@/components/ui/TxTypeBadge';
import { formatTimestamp } from './format-timestamp';
import type { TransactionData, TxClassification } from './types';

interface TxOverviewProps {
  data: TransactionData;
  classification: TxClassification;
}

/** W.cash Ironwood activity, grouped into one compact fact box. */
function PoolActivityBox({
  category,
  counts,
  valueBalance,
}: {
  category: TxCategory;
  counts: { spends: number; outputs: number } | { actions: number };
  valueBalance?: number;
}) {
  return (
    <FactBox label={`${category[0].toUpperCase()}${category.slice(1)} Pool`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <TxTypeBadge category={category} />
        <span className="text-xs text-muted font-mono whitespace-nowrap">
          {'actions' in counts
            ? `${counts.actions} action${counts.actions !== 1 ? 's' : ''}`
            : `${counts.spends} spend${counts.spends !== 1 ? 's' : ''} · ${counts.outputs} output${counts.outputs !== 1 ? 's' : ''}`}
        </span>
      </div>
      {valueBalance != null && valueBalance !== 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-cipher-border/50 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm text-primary tabular-nums">
            {Math.abs(valueBalance).toFixed(8)} {CURRENCY}
          </span>
          <span className="text-[10px] text-muted font-mono whitespace-nowrap">
            {valueBalance < 0 ? '→ entering Ironwood' : '← leaving Ironwood'}
          </span>
        </div>
      )}
    </FactBox>
  );
}

export function TxOverview({ data }: TxOverviewProps) {
  const hasIronwoodActivity = (data.ironwoodActions || 0) > 0;

  return (
    <div>
      <Card className="mb-6">
        <CardBody>
          {/* Line 1: the facts most people came here for. `hug` instead of
              `fit` — these hold very different amounts of content (Block
              has a link + confirmation count + a badge; Size is one short
              string), so equal-width columns just padded the short ones
              with empty space. Sized to content instead. */}
          <div className="flex flex-wrap items-start gap-3">
            <FactBox hug label="Block" tooltip="The block that includes this transaction">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <Link href={`/block/${data.blockHeight}`} className="text-primary hover:underline font-mono">
                  #{data.blockHeight.toLocaleString()}
                </Link>
                <span className="text-muted text-xs whitespace-nowrap">
                  ({data.confirmations.toLocaleString()} confirmation{data.confirmations !== 1 ? 's' : ''})
                </span>
              </div>
            </FactBox>

            <FactBox hug label="Timestamp" tooltip="When this transaction was mined">
              <span className="text-sm text-primary whitespace-nowrap">{formatTimestamp(data.timestamp)}</span>
            </FactBox>

            <FactBox hug label="Fee" tooltip="Fee paid to the miner">
              <span className="text-sm font-mono font-semibold text-primary whitespace-nowrap">
                {data.fee.toFixed(8)} {CURRENCY}
              </span>
            </FactBox>

            <FactBox hug label="Size" tooltip="Transaction size in bytes">
              <span className="text-sm font-mono text-primary whitespace-nowrap tabular-nums">
                {data.size.toLocaleString()} bytes ({(data.size / 1024).toFixed(2)} KB)
              </span>
            </FactBox>
          </div>

          {/* Line 2: consensus/technical fields, always visible — no
              "Show More" gate. Block Hash gets its own wider min-width
              (.fact-box-hash-inline) since a truncated hash + copy button
              needs more room than a short number. */}
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <FactBox hug label="Version" tooltip="Transaction version number">
              <span className="text-sm font-mono text-primary tabular-nums">{data.version}</span>
            </FactBox>

            <FactBox hug label="Lock Time" tooltip="Block height or timestamp at which this transaction is unlocked">
              <span className="text-sm font-mono text-primary tabular-nums">{data.locktime}</span>
            </FactBox>

            {data.expiryHeight != null && data.expiryHeight > 0 && (
              <FactBox
                hug
                label="Expiry Height"
                tooltip="Block height after which this transaction can no longer be mined. The delta from the mined block height indicates the wallet's configured expiry window."
              >
                <span className="text-sm font-mono text-primary tabular-nums whitespace-nowrap">
                  {data.expiryHeight.toLocaleString()}
                  <span className="text-[10px] text-muted ml-1.5">+{data.expiryHeight - (data.blockHeight || 0)} blocks</span>
                </span>
              </FactBox>
            )}

            <FactBox hug label="Block Hash" tooltip="Hash of the block containing this transaction" className="fact-box-hash-inline">
              <CopyableHash value={data.blockHash || ''} href={`/block/${data.blockHeight}`} colorClass="text-primary" />
            </FactBox>

          </div>

          {/* Line 3: shielded pool activity — one box per active pool
              instead of six flat rows (spends, outputs, actions, value
              balance × 3 pools) that gave every pool's data equal weight
              regardless of which pools this transaction actually touched. */}
          {hasIronwoodActivity && (
            <div className="mt-5 pt-4 border-t border-cipher-border/50">
              <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Ironwood Activity</span>
              <div className="mt-3 max-w-md">
                <PoolActivityBox
                  category="ironwood"
                  counts={{ actions: data.ironwoodActions || 0 }}
                  valueBalance={data.valueBalanceIronwood}
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
