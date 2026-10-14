'use client';

import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CopyButton } from '@/components/CopyButton';
import { Icons } from './icons';

export function ShieldedAddressView({
  address,
  copiedText,
  onCopy,
}: {
  address: string;
  copiedText: string | null;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <div className="mb-8">
        <span className="text-xs font-mono text-muted tracking-wider">&gt; ADDRESS_LOOKUP</span>
        <div className="flex flex-wrap items-center gap-3 mt-2 mb-3">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary">W.cash Unified Address</h2>
          <Badge color="purple" icon={<Icons.Shield />}>UNIFIED</Badge>
        </div>
        <div className="flex items-start gap-2"><code className="text-sm text-secondary break-all font-mono flex-1">{address}</code><CopyButton text={address} label="address" copiedText={copiedText} onCopy={onCopy} /></div>
      </div>

      <Card className="mb-6">
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-cipher-purple/10 border border-cipher-purple/20 flex items-center justify-center shrink-0"><Icons.Shield /></div>
            <div>
              <h2 className="text-lg font-semibold text-primary mb-1">Private receiver composition</h2>
              <p className="text-sm text-secondary leading-relaxed">W.cash unified addresses can contain transparent and Ironwood receivers. The receiver composition, private balance, and private history cannot be inferred from the address alone.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 text-xs font-mono">
            <div className="rounded-lg border border-cipher-border bg-cipher-surface/40 p-3"><span className="block text-muted">BALANCE</span><span className="text-cipher-purple">not publicly inferable</span></div>
            <div className="rounded-lg border border-cipher-border bg-cipher-surface/40 p-3"><span className="block text-muted">PRIVATE HISTORY</span><span className="text-cipher-purple">not indexed</span></div>
            <div className="rounded-lg border border-cipher-border bg-cipher-surface/40 p-3"><span className="block text-muted">PUBLIC API</span><span className="text-cipher-green">capability gated</span></div>
          </div>
        </CardBody>
      </Card>

      <div className="rounded-xl border border-cipher-border bg-cipher-surface/50 p-4 text-sm text-secondary">To inspect public activity, open the transparent receiver separately. WcashExplorer does not ask for or accept private keys or viewing keys.</div>
    </div>
  );
}
