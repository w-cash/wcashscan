import { CURRENCY } from '@/lib/config';
import { RedactedAmount } from '@/components/ui/RedactedAmount';
import { TX_CATEGORY_CONFIG } from '@/components/ui/TxTypeBadge';
import { FlowChain, type FlowNode } from './FlowChain';
import { firstOutputAddress, rankedRecipients, type RankedRecipient } from './tx-classification';
import type { TransactionData, TxClassification } from './types';

function TwcAmount({ value, className = '' }: { value: number; className?: string }) {
  return <span className={`text-sm font-mono font-semibold text-primary tabular-nums ${className}`}>{value.toFixed(4)} {CURRENCY}</span>;
}

function poolFlowNode(label: string, amount?: number): FlowNode {
  return { kind: 'pool', label, color: TX_CATEGORY_CONFIG.ironwood.color, amount };
}

function rankedSenders(inputs: TransactionData['inputs']): RankedRecipient[] {
  const totals = new Map<string, number>();
  for (const input of inputs) {
    if (!input.address) continue;
    totals.set(input.address, (totals.get(input.address) || 0) + (input.value || 0));
  }
  return Array.from(totals, ([address, amount]) => ({ address, amount })).sort((a, b) => b.amount - a.amount);
}

function uniqueAddresses(list: Array<{ address?: string | null }>): string[] {
  return Array.from(new Set(list.flatMap((item) => item.address ? [item.address] : [])));
}

function rankedNodes(ranked: RankedRecipient[], showSoloAmount = false): FlowNode[] {
  if (ranked.length === 0) return [];
  if (ranked.length === 1) return [{ kind: 'address', address: ranked[0].address, amount: showSoloAmount ? ranked[0].amount : undefined }];
  const nodes: FlowNode[] = ranked.slice(0, 1).map((item) => ({ kind: 'address', address: item.address, amount: item.amount }));
  const rest = ranked.slice(1);
  nodes.push({ kind: 'more', count: rest.length, amount: rest.reduce((sum, item) => sum + item.amount, 0) });
  return nodes;
}

export function TxHeroFlow({
  data,
  classification,
}: {
  data: TransactionData;
  classification: TxClassification;
}) {
  const { txType, valueBalance, isCoinbase } = classification;

  if (txType === 'IRONWOOD') {
    const node = poolFlowNode('Ironwood');
    return <FlowChain sources={[node]} amount={<RedactedAmount />} destinations={[node]} />;
  }

  if (txType === 'SHIELDING') {
    const fromAddr = data.inputs.find((input) => input.address)?.address;
    return <FlowChain sources={fromAddr ? [{ kind: 'address', address: fromAddr }] : []} amount={<TwcAmount value={Math.abs(valueBalance)} />} destinations={[poolFlowNode('Ironwood')]} />;
  }

  if (txType === 'UNSHIELDING') {
    const toAddr = firstOutputAddress(data.outputs);
    return <FlowChain sources={[poolFlowNode('Ironwood')]} amount={<TwcAmount value={Math.abs(valueBalance)} />} destinations={toAddr ? [{ kind: 'address', address: toAddr }] : []} />;
  }

  if (isCoinbase) {
    const toAddr = firstOutputAddress(data.outputs);
    const ironwoodPortion = valueBalance < 0 ? Math.abs(valueBalance) : 0;
    const destinations: FlowNode[] = [];
    if (toAddr) destinations.push({ kind: 'address', address: toAddr });
    if (ironwoodPortion > 0) destinations.push(poolFlowNode('Ironwood'));
    return <FlowChain sources={[{ kind: 'pool', label: 'Block Reward', color: TX_CATEGORY_CONFIG.coinbase.color }]} amount={<TwcAmount value={data.totalOutput + ironwoodPortion} />} destinations={destinations} />;
  }

  if (txType === 'MIXED') {
    const senders = rankedSenders(data.inputs);
    const senderAddresses = new Set(senders.map((sender) => sender.address));
    const recipients = rankedRecipients(data.outputs, []);
    const destinations = rankedNodes(recipients, recipients.length > 1).map((node) => node.kind === 'address' && senderAddresses.has(node.address) ? { ...node, amount: undefined } : node);
    const poolAmount = Math.abs(valueBalance);
    if (valueBalance < 0) destinations.push(poolFlowNode('Ironwood', poolAmount));
    const centerAmount = recipients.reduce((sum, item) => sum + item.amount, 0) + (valueBalance < 0 ? poolAmount : 0);
    const sources = rankedNodes(senders);
    if (valueBalance > 0) sources.push(poolFlowNode('Ironwood', poolAmount));
    return <FlowChain sources={sources} amount={<TwcAmount value={centerAmount} />} destinations={destinations} />;
  }

  const fromAddresses = uniqueAddresses(data.inputs);
  const recipients = rankedRecipients(data.outputs, fromAddresses);
  const destinations = rankedNodes(recipients);
  const fallback = firstOutputAddress(data.outputs);
  if (destinations.length === 0 && fallback) destinations.push({ kind: 'address', address: fallback });
  const amount = recipients.reduce((sum, item) => sum + item.amount, 0) || data.totalOutput || data.totalInput;
  return <FlowChain sources={rankedNodes(rankedSenders(data.inputs))} amount={<TwcAmount value={amount} />} destinations={destinations} />;
}
