import type { Metadata } from 'next';
import {
  parseTransactionsRequest,
  getArchiveCanonicalPath,
  hasShieldedSubFilters,
  renderTransactionsPage,
} from './render';
import type { SearchParams } from './render';
import { buildPageMetadata, getBaseUrl } from '@/lib/seo';

interface TransactionsPageProps {
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ searchParams }: TransactionsPageProps): Promise<Metadata> {
  const request = parseTransactionsRequest(await searchParams);
  const isStableArchive = (request.type === 'all' || (request.type === 'shielded' && !hasShieldedSubFilters(request)))
    && (request.page === 1 || request.direction === 'next')
    && request.pageParamConsistent;
  const pageSuffix = request.page > 1 ? ` - Page ${request.page}` : '';

  if (request.type === 'shielded') {
    return buildPageMetadata({
      title: `W.cash Ironwood Transactions${pageSuffix} | WcashExplorer`,
      description: request.page > 1
        ? `Browse W.cash Ironwood transaction archive page ${request.page}, including public-to-private and private-to-public flow observations.`
        : 'Browse W.cash Ironwood transactions and track public-to-private and private-to-public flow observations.',
      path: isStableArchive ? getArchiveCanonicalPath(request) : '/txs?type=shielded',
      index: isStableArchive && request.page === 1,
      keywords: ['wcash Ironwood transactions', 'TWC privacy', 'wcash explorer'],
    });
  }

  return buildPageMetadata({
    title: `Latest W.cash Transactions${pageSuffix} | WcashExplorer`,
    description: request.page > 1
      ? `Browse W.cash transaction archive page ${request.page}, with transaction hashes, block heights, transaction types, sizes, and confirmation times.`
      : 'Browse the latest W.cash transactions including Ironwood, transparent, and coinbase transactions.',
    path: isStableArchive ? getArchiveCanonicalPath(request) : '/txs',
    index: isStableArchive && request.page === 1,
    keywords: ['wcash transactions', 'wcash transaction explorer', 'TWC transactions'],
  });
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  return renderTransactionsPage(searchParams);
}
