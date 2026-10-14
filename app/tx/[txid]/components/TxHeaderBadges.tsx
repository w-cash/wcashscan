'use client';

import { ExportButton } from '@/components/ExportButton';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { TxTypeBadge, type TxCategory } from '@/components/ui/TxTypeBadge';
import { NetworkIcon } from '@/components/icons/common';
import { getNetworkLabel } from '@/lib/network';
import type { TransactionData, TxClassification, TxType } from './types';

interface TxHeaderBadgesProps {
  data: TransactionData;
  classification: TxClassification;
}

// The header's one categorical "Type" badge uses only W.cash transaction
// shapes and the Ironwood activity category.
const TX_TYPE_TO_CATEGORY: Partial<Record<TxType, TxCategory>> = {
  COINBASE: 'coinbase',
  IRONWOOD: 'ironwood',
  SHIELDING: 'shielding',
  UNSHIELDING: 'unshielding',
  MIXED: 'mixed',
  REGULAR: 'transparent',
};

export function TxHeaderBadges({ data, classification }: TxHeaderBadgesProps) {
  const { txType } = classification;
  const category = TX_TYPE_TO_CATEGORY[txType];
  const networkLabel = getNetworkLabel();

  return (
    <div className="flex items-center justify-between gap-2 mb-4 animate-fade-in-up">
      {/* General -> specific: network context, lifecycle status, then the
          W.cash transaction category. */}
      <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
        <Badge color="muted" icon={<NetworkIcon />} variant="subtle">
          {networkLabel}
        </Badge>
        {data.status === 'stale' || data.isCanonical === false ? (
          <StatusBadge status="reorganized" variant="subtle" />
        ) : data.status === 'unknown' ? (
          <Badge color="muted" variant="subtle">UNKNOWN</Badge>
        ) : (
          <StatusBadge status="confirmed" variant="subtle" />
        )}
        {category && <TxTypeBadge category={category} variant="subtle" />}
      </div>
      <ExportButton
        data={{
          txid: data.txid,
          blockHeight: data.blockHeight,
          blockHash: data.blockHash,
          timestamp: data.timestamp,
          confirmations: data.confirmations,
          fee: data.fee,
          size: data.size,
          version: data.version,
          locktime: data.locktime,
          totalInput: data.totalInput,
          totalOutput: data.totalOutput,
          ironwoodActions: data.ironwoodActions,
          inputs: data.inputs.map((i: any) => ({
            address: i.address || 'shielded',
            value: i.value,
            coinbase: i.coinbase || false,
          })),
          outputs: data.outputs.map((o: any) => ({
            address: o.scriptPubKey?.addresses?.[0] || 'shielded',
            value: o.value,
            index: o.n,
            spent: o.spent || false,
          })),
        }}
        filename={`tx-${data.txid.slice(0, 16)}`}
        type="json"
        label="Export"
      />
    </div>
  );
}
