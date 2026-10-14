'use client';

import Link from 'next/link';
import { CURRENCY } from '@/lib/config';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TxTypeBadge } from '@/components/ui/TxTypeBadge';
import { RedactedAmount } from '@/components/ui/RedactedAmount';
import { CopyButton } from '@/components/CopyButton';
import type { TransactionData } from './types';

export function InputsSection({ data, copiedText, onCopy }: {
  data: TransactionData;
  copiedText: string | null;
  onCopy: (text: string, label: string) => void;
}) {
  const publicInputs = data.inputs.filter((input) => !input.coinbase);
  const privateActions = data.ironwoodActions > 0 && (data.valueBalanceIronwood || 0) > 0;
  const count = publicInputs.length + (privateActions ? data.ironwoodActions : 0) + (data.isCoinbase ? 1 : 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><span className="text-xs font-mono text-muted tracking-wider">&gt; INPUTS</span><Badge color="muted">{count}</Badge></div>
        {data.totalInput > 0 && <span className="text-xs text-muted font-mono ml-auto">{data.totalInput.toFixed(4)} {CURRENCY}</span>}
      </CardHeader>
      <CardBody>
        <div className="divide-y divide-cipher-border">
          {data.inputs.map((input, index) => (
            <div key={index} className="flex items-center py-2 first:pt-0 last:pb-0 gap-2 overflow-hidden">
              <span className="text-[10px] text-muted font-mono w-4 shrink-0 text-right">{index}</span>
              <div className="min-w-0 flex-1 overflow-hidden">
                {input.coinbase ? (
                  <div className="space-y-1"><span className="text-xs text-muted font-mono">Block Reward</span>{data.coinbaseText && <code className="block text-[10px] text-cipher-cyan break-all">{data.coinbaseText}</code>}</div>
                ) : input.address ? (
                  <div className="flex items-center gap-1 min-w-0"><Link href={`/address/${input.address}`} className="min-w-0 block overflow-hidden"><code className="text-[11px] text-primary hover:underline font-mono truncate block">{input.address}</code></Link><CopyButton text={input.address} label={`input-${index}`} copiedText={copiedText} onCopy={onCopy} /></div>
                ) : <span className="text-xs text-muted font-mono italic">Public input address unavailable</span>}
              </div>
              {!input.coinbase && <span className="text-[11px] font-mono text-primary shrink-0 tabular-nums">{input.value?.toFixed(8)} {CURRENCY}</span>}
            </div>
          ))}
          {privateActions && Array.from({ length: data.ironwoodActions }).map((_, index) => (
            <div key={`ironwood-${index}`} className="flex items-center py-2 gap-2">
              <span className="text-[10px] text-muted font-mono w-4 shrink-0 text-right">{data.inputs.length + index}</span>
              <div className="flex items-center gap-1.5 min-w-0 flex-1"><TxTypeBadge category="ironwood" label="IRONWOOD INPUT" /></div>
              <RedactedAmount className="shrink-0 !text-[10px]" />
            </div>
          ))}
          {count === 0 && <p className="text-xs text-muted font-mono py-2 text-center">No public inputs</p>}
        </div>
      </CardBody>
    </Card>
  );
}
