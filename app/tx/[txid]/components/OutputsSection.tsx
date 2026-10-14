'use client';

import Link from 'next/link';
import { CURRENCY } from '@/lib/config';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TxTypeBadge } from '@/components/ui/TxTypeBadge';
import { RedactedAmount } from '@/components/ui/RedactedAmount';
import { CopyButton } from '@/components/CopyButton';
import type { TransactionData } from './types';

export function OutputsSection({ data, copiedText, onCopy }: {
  data: TransactionData;
  classification: unknown;
  copiedText: string | null;
  onCopy: (text: string, label: string) => void;
}) {
  const ironwoodDeposit = (data.valueBalanceIronwood || 0) < 0 ? Math.abs(data.valueBalanceIronwood || 0) : 0;
  const privateActions = data.ironwoodActions > 0 && data.outputs.length === 0 && ironwoodDeposit === 0;
  const count = data.outputs.length + (ironwoodDeposit > 0 ? 1 : 0) + (privateActions ? data.ironwoodActions : 0);
  const knownOutputTotal = data.totalOutput + ironwoodDeposit;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><span className="text-xs font-mono text-muted tracking-wider">&gt; OUTPUTS</span><Badge color="muted">{count}</Badge></div>
        {knownOutputTotal > 0 && <span className="text-xs text-muted font-mono ml-auto">{knownOutputTotal.toFixed(4)} {CURRENCY}</span>}
      </CardHeader>
      <CardBody>
        <div className="divide-y divide-cipher-border">
          {data.outputs.map((output, index) => {
            const address = output.scriptPubKey?.addresses?.[0] || output.address;
            return <div key={index} className="flex items-center py-2 first:pt-0 last:pb-0 gap-2 overflow-hidden">
              <span className="text-[10px] text-muted font-mono w-4 shrink-0 text-right">{index}</span>
              <div className="min-w-0 flex-1 overflow-hidden">{address ? <div className="flex items-center gap-1 min-w-0"><Link href={`/address/${address}`} className="min-w-0 block overflow-hidden"><code className="text-[11px] text-primary hover:underline font-mono truncate block">{address}</code></Link><CopyButton text={address} label={`output-${index}`} copiedText={copiedText} onCopy={onCopy} /></div> : <span className="text-xs text-muted font-mono italic">Public output address unavailable</span>}</div>
              <span className="text-[11px] font-mono text-primary shrink-0 tabular-nums">{output.value?.toFixed(8)} {CURRENCY}</span>
            </div>;
          })}
          {ironwoodDeposit > 0 && <div className="flex items-center py-2 gap-2"><span className="text-[10px] text-muted font-mono w-4 shrink-0 text-right">{data.outputs.length}</span><div className="flex items-center gap-1.5 min-w-0 flex-1"><TxTypeBadge category="ironwood" label="IRONWOOD POOL" /></div><span className="text-[11px] font-mono text-primary font-semibold shrink-0">{ironwoodDeposit.toFixed(8)} {CURRENCY}</span></div>}
          {privateActions && Array.from({ length: data.ironwoodActions }).map((_, index) => <div key={`ironwood-${index}`} className="flex items-center py-2 gap-2"><span className="text-[10px] text-muted font-mono w-4 shrink-0 text-right">{data.outputs.length + index}</span><div className="flex items-center gap-1.5 min-w-0 flex-1"><TxTypeBadge category="ironwood" label="IRONWOOD OUTPUT" /></div><RedactedAmount className="shrink-0 !text-[10px]" /></div>)}
          {count === 0 && <p className="text-xs text-muted font-mono py-2 text-center">No public outputs</p>}
        </div>
      </CardBody>
    </Card>
  );
}
