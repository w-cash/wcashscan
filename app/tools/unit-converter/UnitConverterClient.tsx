'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';

const ZATOSHI_PER_TWC = BigInt(100_000_000);

function twcToZatoshi(value: string): bigint | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{0,8})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * ZATOSHI_PER_TWC + BigInt(fraction.padEnd(8, '0') || '0');
}

function zatoshiToTwc(value: string): string {
  const amount = BigInt(value.replace(/,/g, ''));
  if (amount < BigInt(0)) throw new Error('negative amount');
  const whole = amount / ZATOSHI_PER_TWC;
  const fraction = (amount % ZATOSHI_PER_TWC).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="rounded-md p-1.5 text-muted hover:bg-cipher-hover hover:text-primary"
      aria-label={`Copy ${value}`}
    >{copied ? '✓' : '⧉'}</button>
  );
}

export default function UnitConverterClient() {
  const [twc, setTwc] = useState('');
  const [zatoshi, setZatoshi] = useState('');
  const [error, setError] = useState<string | null>(null);

  const updateTwc = (value: string) => {
    setTwc(value);
    const converted = twcToZatoshi(value);
    setZatoshi(converted == null ? '' : converted.toString());
    setError(value && converted == null ? 'Use a non-negative TWC amount with at most 8 decimal places.' : null);
  };

  const updateZatoshi = (value: string) => {
    setZatoshi(value);
    try {
      setTwc(value.trim() ? zatoshiToTwc(value) : '');
      setError(null);
    } catch {
      setTwc('');
      setError(value ? 'Use a non-negative integer zatoshi amount.' : null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <Link href="/tools" className="text-xs font-mono text-muted hover:text-primary">← W.cash tools</Link>
        <h1 className="mt-4 text-2xl md:text-3xl font-bold text-primary">TWC ↔ zatoshi</h1>
        <p className="mt-1 text-sm text-secondary">1 TWC = 100,000,000 zatoshi. Conversion is local and uses integer arithmetic.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardBody className="space-y-5">
            <label className="block text-xs font-mono uppercase tracking-wider text-muted" htmlFor="twc-amount">TWC</label>
            <div className="flex gap-2">
              <input id="twc-amount" className="input-field flex-1 font-mono" inputMode="decimal" value={twc} onChange={(event) => updateTwc(event.target.value)} placeholder="0.5" />
              <CopyButton value={twc} />
            </div>
            <div className="text-center text-xl text-muted">↕</div>
            <label className="block text-xs font-mono uppercase tracking-wider text-muted" htmlFor="zatoshi-amount">Zatoshi</label>
            <div className="flex gap-2">
              <input id="zatoshi-amount" className="input-field flex-1 font-mono" inputMode="numeric" value={zatoshi} onChange={(event) => updateZatoshi(event.target.value)} placeholder="50000000" />
              <CopyButton value={zatoshi.replace(/,/g, '')} />
            </div>
            {error && <p className="text-xs text-cipher-orange" role="alert">{error}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="text-sm font-bold font-mono text-primary">Reference values</h2>
            <div className="mt-4 divide-y divide-cipher-border text-xs font-mono">
              {[
                ['1 TWC', '100000000 zatoshi'],
                ['1 zatoshi', '0.00000001 TWC'],
                ['0.0001 TWC', '10000 zatoshi'],
                ['1,000,000 zatoshi', '0.01 TWC'],
              ].map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-3"><span className="text-muted">{label}</span><span className="text-secondary">{value}</span></div>)}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-muted">The explorer labels database amounts as zatoshi when precision matters and TWC when displaying human-readable totals.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
