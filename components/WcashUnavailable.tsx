import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';

export function WcashUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card>
        <CardBody className="py-14 text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-3">W.CASH_CAPABILITY</p>
          <h1 className="text-2xl font-bold font-mono text-primary mb-3">{title}</h1>
          <p className="text-sm leading-relaxed text-secondary max-w-xl mx-auto">{detail}</p>
          <Link href="/tools" className="inline-block mt-6 text-sm font-mono text-cipher-cyan hover:underline">
            Back to W.cash tools →
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
