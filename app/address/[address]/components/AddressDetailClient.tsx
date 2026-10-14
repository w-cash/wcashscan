'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '@/lib/api-config';
import type { AddressMeta } from '@/lib/seo';
import { zatToTwc } from '@/lib/format-numbers';
import { AddressHeader } from './AddressHeader';
import { AddressHeroCard } from './AddressHeroCard';
import { AddressTabBar } from './AddressTabBar';
import { AddressLoadingSkeleton } from './AddressLoadingSkeleton';
import { EmptyAddressView, IndexingIssueView } from './AddressStateViews';
import { ShieldedAddressView } from './ShieldedAddressView';
import { TransactionTable } from './TransactionTable';
import { AddressSummary } from './AddressSummary';

import {
  transformTransactions,
  getTypeInfo,
  isPrivateAddress,
  hasNoTransactions,
  hasIndexingIssue,
} from './helpers';
import type { AddressData, AddressTab } from './types';

const PAGE_SIZE = 25;

interface AddressDetailClientProps {
  address: string;
  /** Server-resolved summary from `getAddressResolution` — seeds the loading state. */
  initialMeta?: AddressMeta | null;
}

export function AddressDetailClient({ address, initialMeta = null }: AddressDetailClientProps) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<AddressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AddressTab>('transactions');

  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const [totalPages, setTotalPages] = useState(1);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const fetchPageData = useCallback(async () => {
    try {
      setLoading(true);

      const apiUrl = `${getApiUrl()}/api/address/${address}?page=${currentPage}&limit=${PAGE_SIZE}`;

      const response = await fetch(apiUrl);

      if (!response.ok) throw new Error('Failed to fetch address data');
      const apiData = await response.json();

      setTotalPages(apiData.pagination?.totalPages || 1);

      const transformedTransactions = transformTransactions(apiData, apiData.transactions || []);
      setData({
        address: apiData.address,
        balance: apiData.balance == null ? 0 : zatToTwc(apiData.balance),
        type: apiData.type || 'transparent',
        transactions: transformedTransactions,
        transactionCount: apiData.txCount || apiData.transactionCount,
        note: apiData.note,
        firstSeen: apiData.firstSeen,
        lastSeen: apiData.lastSeen,
        firstFunding: apiData.firstFunding ?? null,
      });

    } catch (error) {
      console.error('Error fetching address data:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [address, currentPage]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  if (loading) {
    return <AddressLoadingSkeleton initialMeta={initialMeta} address={address} />;
  }

  const shielded = isPrivateAddress(data);
  const noTransactions = hasNoTransactions(data);
  const indexingIssue = hasIndexingIssue(data, shielded, noTransactions);

  if (shielded) {
    return (
      <ShieldedAddressView
        address={address}
        copiedText={copiedText}
        onCopy={copyToClipboard}
      />
    );
  }

  if (noTransactions && data) {
    return (
      <EmptyAddressView
        address={address}
        copiedText={copiedText}
        onCopy={copyToClipboard}
      />
    );
  }

  if (!data || indexingIssue) {
    return (
      <IndexingIssueView
        address={address}
        copiedText={copiedText}
        onCopy={copyToClipboard}
      />
    );
  }

  const typeInfo = getTypeInfo(data.type);
  const totalTxCount = data.transactionCount || data.transactions.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 animate-fade-in">
      <AddressHeader
        address={address}
        data={data}
        typeInfo={typeInfo}
        copiedText={copiedText}
        onCopy={copyToClipboard}
      />

      <AddressHeroCard
        data={data}
        summary={<AddressSummary data={data} totalTxCount={totalTxCount} />}
      />

      <AddressTabBar
        activeTab={activeTab}
        totalTxCount={totalTxCount}
        onTabChange={setActiveTab}
      />

      <TransactionTable
        address={address}
        data={data}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        totalTxCount={totalTxCount}
      />
    </div>
  );
}
