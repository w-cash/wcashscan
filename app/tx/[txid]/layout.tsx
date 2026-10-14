import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import {
  buildPageMetadata,
  getApiUrl,
  getBaseUrl,
  getNetwork,
  getTxResolution,
  truncateHash,
  formatNumber,
  type TxMeta,
} from '@/lib/seo';
import { fetchWithDeadline } from '@/lib/server-fetch';
import { CopyButton } from '@/components/CopyButton';

type Props = {
  params: Promise<{ txid: string }>;
  children: React.ReactNode;
};

// No page-level revalidate — the fetch-level values inside getTxResolution
// control ISR dynamically: 300s for confirmed txs, 10s for pending/absent.

export function generateStaticParams(): Array<{ txid: string }> {
  return [];
}

function getTxType(meta: { isCoinbase: boolean; hasIronwood: boolean }): string {
  if (meta.isCoinbase) return 'Coinbase';
  if (meta.hasIronwood) return 'Ironwood';
  return 'Transparent';
}

type TransactionStatus = 'Confirmed' | 'Pending' | 'Reorganized' | 'Unknown';

type AlternateHashResolution = 'block' | 'absent' | 'unavailable';

const resolveAlternateHash = cache(async (hash: string): Promise<AlternateHashResolution> => {
  try {
    const blockResponse = await fetchWithDeadline(`${getApiUrl()}/api/block/${hash}?summary=1`, {
      next: { revalidate: 300 },
    });
    if (blockResponse.ok) return 'block';
    if (blockResponse.status !== 404 && blockResponse.status !== 410) return 'unavailable';

    return 'absent';
  } catch {
    return 'unavailable';
  }
});

function getTransactionStatus(meta: TxMeta | null): TransactionStatus {
  if (!meta) return 'Unknown';
  if (meta.status === 'confirmed') return 'Confirmed';
  if (meta.status === 'pending') return 'Pending';
  if (meta.status === 'stale') return 'Reorganized';
  return 'Unknown';
}

function getStatusDescription(status: TransactionStatus, meta: TxMeta | null): string {
  if (status === 'Confirmed' && meta) {
    return `Included in canonical W.cash block #${formatNumber(meta.blockHeight)} with ${formatNumber(meta.confirmations)} confirmation${meta.confirmations === 1 ? '' : 's'}.`;
  }

  if (status === 'Pending') {
    return 'Waiting in the W.cash mempool with 0 confirmations. This page updates after the transaction is mined.';
  }

  if (status === 'Reorganized' && meta) {
    return `Previously recorded in block #${formatNumber(meta.blockHeight)}, but that block is no longer on the canonical chain.`;
  }

  return 'WcashExplorer cannot currently verify this transaction state. The transaction may be unindexed, absent, or temporarily unavailable from the W.cash data service.';
}

function getNetworkName(): string {
  const network = getNetwork();
  if (network === 'mainnet') return 'W.cash mainnet preview';
  return 'W.cash Testnet (TWC)';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { txid } = await params;
  const normalizedTxid = txid.toLowerCase();
  const path = `/tx/${normalizedTxid}`;

  if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    return buildPageMetadata({
      title: 'Invalid W.cash Transaction | WcashExplorer',
      description: 'This transaction identifier is not a valid 64-character W.cash transaction hash.',
      path,
      index: false,
      canonical: false,
    });
  }

  const resolution = await getTxResolution(normalizedTxid);

  if (resolution.state === 'unavailable') {
    return buildPageMetadata({
      title: `W.cash Transaction ${truncateHash(normalizedTxid)} Status Unknown | WcashExplorer`,
      description: `WcashExplorer cannot currently verify the status of W.cash transaction ${truncateHash(normalizedTxid)} because a required data service is temporarily unavailable.`,
      path,
      index: false,
      canonical: true,
    });
  }

  if (resolution.state === 'absent') {
    return buildPageMetadata({
      title: `W.cash Transaction ${truncateHash(normalizedTxid)} Not Found | WcashExplorer`,
      description: `WcashExplorer could not find W.cash transaction ${truncateHash(normalizedTxid)} in the confirmed index or mempool.`,
      path,
      index: false,
      canonical: false,
    });
  }

  const tx = resolution.meta;

  const txType = getTxType(tx);
  const status = getTransactionStatus(tx);
  const isPending = status === 'Pending';
  const isConfirmed = status === 'Confirmed';
  const title = isPending
    ? `Pending W.cash Transaction ${truncateHash(tx.txid)} | WcashExplorer`
    : isConfirmed
      ? `W.cash Transaction ${truncateHash(tx.txid)} | WcashExplorer`
      : status === 'Reorganized'
        ? `Reorganized W.cash Transaction ${truncateHash(tx.txid)} | WcashExplorer`
        : `W.cash Transaction ${truncateHash(tx.txid)} Status Unknown | WcashExplorer`;
  const description = isPending
    ? `${txType} W.cash transaction currently pending in the mempool with 0 confirmations. This page updates when the transaction is mined.`
    : isConfirmed
      ? `${txType} W.cash transaction in block #${formatNumber(tx.blockHeight)} with ${formatNumber(tx.confirmations)} confirmation${tx.confirmations !== 1 ? 's' : ''}.`
      : status === 'Reorganized'
        ? `This W.cash transaction is no longer verified in its recorded block after a chain reorganization. WcashExplorer will update this page if it returns to the mempool or confirms again.`
        : `WcashExplorer has a record for this W.cash transaction but cannot currently verify its canonical-chain status.`;

  return buildPageMetadata({
    title,
    description,
    path,
    index: isPending || isConfirmed,
    imageAlt: `${status} W.cash transaction ${truncateHash(tx.txid)}`,
  });
}

export default async function TxLayout({ params, children }: Props) {
  const { txid } = await params;

  // The syntax check is authoritative. A valid-looking hash is not treated as
  // absent here because API and mempool failures are intentionally represented
  // as an unknown state, and the client may still redirect block/finalizer IDs.
  if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    notFound();
  }

  const normalizedTxid = txid.toLowerCase();
  const resolution = await getTxResolution(normalizedTxid);

  if (resolution.state === 'unavailable') {
    // Render the client shell with an unknown status. The browser can retry
    // the W.cash API without turning an API outage into an HTTP 500.
  }

  if (resolution.state === 'absent') {
    const alternate = await resolveAlternateHash(normalizedTxid);
    if (alternate === 'block') redirect(`/block/${normalizedTxid}`);
    if (alternate === 'absent') notFound();
    // Keep the unknown transaction shell; the alternate lookup can be retried
    // by the client once the W.cash API is available again.
  }

  const tx = resolution.state === 'found' ? resolution.meta : null;
  const status = getTransactionStatus(tx);
  const statusDescription = getStatusDescription(status, tx);
  const networkName = getNetworkName();
  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/tx/${normalizedTxid}`;
  const txType = tx ? getTxType(tx) : null;

  const variableMeasured: Array<Record<string, string | number>> = [
    {
      '@type': 'PropertyValue',
      name: 'Network',
      value: networkName,
    },
    {
      '@type': 'PropertyValue',
      name: 'Transaction status',
      value: status,
    },
  ];

  if (txType) {
    variableMeasured.push({
      '@type': 'PropertyValue',
      name: 'Transaction type',
      value: txType,
    });
  }

  if (tx && tx.blockHeight > 0 && status !== 'Pending') {
    variableMeasured.push({
      '@type': 'PropertyValue',
      name: status === 'Reorganized' ? 'Recorded block height' : 'Block height',
      value: tx.blockHeight,
    });
  }

  if (status === 'Confirmed' || status === 'Pending') {
    variableMeasured.push({
      '@type': 'PropertyValue',
      name: 'Confirmations',
      value: tx?.confirmations ?? 0,
    });
  }

  const transactionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: `W.cash transaction ${normalizedTxid}`,
    description: statusDescription,
    isPartOf: { '@id': `${baseUrl}/#website` },
    mainEntity: {
      '@type': 'Dataset',
      '@id': `${canonicalUrl}#transaction`,
      name: `W.cash transaction ${normalizedTxid}`,
      url: canonicalUrl,
      description: statusDescription,
      creator: { '@id': `${baseUrl}/#organization` },
      isPartOf: { '@id': `${baseUrl}/#website` },
      identifier: {
        '@type': 'PropertyValue',
        propertyID: 'W.cash transaction ID',
        value: normalizedTxid,
      },
      variableMeasured,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(transactionJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-12"
        aria-labelledby="transaction-heading"
      >
        <p className="text-xs font-mono text-muted tracking-wider">&gt; TX_LOOKUP</p>
        <h1 id="transaction-heading" className="mt-2">
          <span className="block text-lg sm:text-xl font-semibold tracking-tight text-primary">
            W.cash Transaction
          </span>
          <span className="mt-2 flex items-center gap-2 min-w-0">
            <span className="text-sm sm:text-base font-mono font-normal text-primary break-all">
              {normalizedTxid}
            </span>
            <CopyButton text={normalizedTxid} size="sm" className="shrink-0" />
          </span>
        </h1>
        <p className="sr-only">{statusDescription}</p>
      </section>
      {children}
    </>
  );
}
