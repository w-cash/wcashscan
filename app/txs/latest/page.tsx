import type { Metadata } from 'next';
import { renderTransactionsPage, parseTransactionsRequest, getArchiveCanonicalPath, hasShieldedSubFilters } from '../render';
import { buildPageMetadata } from '@/lib/seo';

export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const request = parseTransactionsRequest({});
  const isStableArchive = (request.type === 'all' || (request.type === 'shielded' && !hasShieldedSubFilters(request)))
    && (request.page === 1 || request.direction === 'next')
    && request.pageParamConsistent;

  return buildPageMetadata({
    title: 'Latest W.cash Transactions | WcashExplorer',
    description: 'Browse the latest W.cash transactions including Ironwood, transparent, and coinbase transactions.',
    path: isStableArchive ? getArchiveCanonicalPath(request) : '/txs',
    index: isStableArchive && request.page === 1,
    keywords: ['W.cash transactions', 'Wcash transaction explorer', 'TWC transactions', 'Ironwood transactions'],
  });
}

export default function LatestTransactionsPage() {
  return renderTransactionsPage(Promise.resolve({}), 'shell');
}
