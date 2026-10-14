import PrivacyClient from './PrivacyClient';

export default function PrivacyPage() {
  return <>
    <PrivacyClient />
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="border-t border-cipher-border pt-8 max-w-3xl">
        <h2 className="text-sm font-bold font-sans text-secondary mb-3">How this dashboard works</h2>
        <p className="text-sm text-muted leading-relaxed">
          WcashExplorer reports public W.cash Testnet activity from the W.cash indexer. Ironwood
          flows and transparent transactions are counted in their native units. A public amount/time
          similarity is an observation, not proof of wallet ownership; private recipients are never decoded.
        </p>
      </div>
    </section>
  </>;
}
