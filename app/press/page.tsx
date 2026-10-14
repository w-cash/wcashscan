import Image from 'next/image';
import Link from 'next/link';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Press & Brand | WcashExplorer',
  description: 'WcashExplorer media and brand reference for W.cash listings and integrations.',
  path: '/press',
  networks: ['mainnet'],
});

export default function PressPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">Press &amp; brand</p>
        <h1 className="text-3xl font-bold font-mono text-primary">WcashExplorer media kit</h1>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          WcashExplorer is the W.cash blockchain explorer built from the W.cash scanner UI and logic.
          It makes indexed blocks, transactions, Ironwood activity, mining, and network health easy to inspect.
        </p>
      </header>

      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold font-mono text-primary mb-4">Approved description</h2>
        <blockquote className="border-l-2 border-cipher-cyan pl-4 text-sm leading-relaxed text-secondary">
          WcashExplorer is an open-source W.cash blockchain scanner. Its data path is Wolf, the adapted W.cash
          indexer, PostgreSQL, and a read-only API consumed by the explorer frontend.
        </blockquote>
      </section>

      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold font-mono text-primary mb-4">Brand</h2>
        <div className="flex items-center gap-3 rounded-xl border border-cipher-border/30 bg-cipher-bg-dark p-5 mb-5">
          <Image src="/logo.png" alt="WcashExplorer" width={48} height={48} unoptimized />
          <span className="text-xl font-bold font-mono tracking-wider text-cipher-cyan-bright">WCASHEXPLORER</span>
        </div>
        <p className="text-xs text-secondary">
          Use “WcashExplorer” for the product name and “W.cash” for the network. The mainnet build is currently a
          labeled preview backed by W.cash Testnet data until a production mainnet API is configured.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-bold font-mono text-primary mb-4">Source and contact</h2>
        <div className="space-y-2 text-sm">
          <p className="text-secondary">Source: <a className="text-cipher-cyan hover:underline" href="https://github.com/w-cash/wcashscan" target="_blank" rel="noreferrer">github.com/w-cash/wcashscan</a></p>
          <p className="text-secondary">Explorer: <Link className="text-cipher-cyan hover:underline" href="/">WcashExplorer home</Link></p>
          <p className="text-secondary">No private keys, tokens, credentials, or fabricated network data belong in this project.</p>
        </div>
      </section>
    </div>
  );
}
