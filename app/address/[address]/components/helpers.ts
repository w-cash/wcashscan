import { zatToTwc } from '@/lib/format-numbers';
import type { AddressData, Transaction } from './types';

export function transformTransactions(apiData: { address: string }, txList: unknown[]): Transaction[] {
  return txList.map((rawTx) => {
    const tx = rawTx as {
      hasIronwood?: boolean;
      netChange: number;
      counterparty?: string;
      txid: string;
      blockTime: number;
      blockHeight?: number;
      txIndex?: number;
      inputValue?: number;
      outputValue?: number;
      senderCount?: number;
    };
    const hasIronwood = Boolean(tx.hasIronwood);
    const isReceiving = tx.netChange > 0;
    const isSending = tx.netChange < 0;
    let from: string | null = null;
    let to: string | null = null;

    if (isReceiving) {
      to = apiData.address;
      from = tx.counterparty || (hasIronwood ? 'ironwood' : null);
    } else if (isSending) {
      from = apiData.address;
      to = tx.counterparty || (hasIronwood ? 'ironwood' : null);
    }

    return {
      txid: tx.txid,
      timestamp: tx.blockTime,
      amount: Math.abs(zatToTwc(tx.netChange)),
      type: isReceiving ? 'received' : 'sent',
      blockHeight: tx.blockHeight,
      from,
      to,
      isCoinbase: tx.txIndex === 0 && tx.inputValue === 0 && !hasIronwood && tx.senderCount === 0,
      isIronwood: hasIronwood,
      isDeshielding: !tx.counterparty && tx.outputValue !== undefined && tx.outputValue > 0 && hasIronwood && isReceiving,
      isShielding: !tx.counterparty && hasIronwood && isSending,
    };
  });
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffMins > 0) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  return 'Just now';
}

export function formatAbsoluteDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatHumanDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function getTypeInfo(type: AddressData['type']) {
  return type === 'unified'
    ? { label: 'UNIFIED', color: 'purple', description: 'W.cash unified receiver; private composition is not exposed' }
    : { label: 'TRANSPARENT', color: 'muted', description: 'Public W.cash address; indexed activity is visible' };
}

export function isPrivateAddress(data: AddressData | null): boolean {
  return data?.type === 'unified' && Boolean(data.note?.includes('Wcash Unified address'));
}

export function hasNoTransactions(data: AddressData | null): boolean {
  return Boolean(data?.note?.includes('no transaction history yet'));
}

export function hasIndexingIssue(data: AddressData | null, isPrivate: boolean, noTransactions: boolean): boolean {
  return !isPrivate && !noTransactions && Boolean(data?.note && (
    data.note.includes('not found') || data.note.includes('indexing') || data.note.includes('Unable to connect')
  ));
}
