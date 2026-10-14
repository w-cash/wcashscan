import type { TransactionData, TxClassification } from './types';

export function firstOutputAddress(outputs: TransactionData['outputs']): string | undefined {
  return outputs.find((output) => output.scriptPubKey?.addresses?.[0] || output.address)?.scriptPubKey?.addresses?.[0]
    || outputs.find((output) => output.address)?.address
    || undefined;
}

export interface RankedRecipient {
  address: string;
  amount: number;
}

export function rankedRecipients(
  outputs: TransactionData['outputs'],
  excludeAddresses: string[],
): RankedRecipient[] {
  const excluded = new Set(excludeAddresses);
  const totals = new Map<string, number>();
  for (const output of outputs) {
    const address = output.scriptPubKey?.addresses?.[0] || output.address || undefined;
    if (!address || excluded.has(address)) continue;
    totals.set(address, (totals.get(address) || 0) + (output.value || 0));
  }
  return Array.from(totals, ([address, amount]) => ({ address, amount })).sort((a, b) => b.amount - a.amount);
}

export function classifyTransaction(data: TransactionData): TxClassification {
  const isCoinbase = Boolean(data.isCoinbase || data.inputs.some((input) => input.coinbase));
  const hasIronwood = data.hasIronwood || data.ironwoodActions > 0;
  const hasTransparentInputs = data.inputs.some((input) => !input.coinbase && Boolean(input.address));
  const hasTransparentOutputs = data.outputs.some((output) => Boolean(output.scriptPubKey?.addresses?.[0] || output.address));
  const hasTransparent = hasTransparentInputs || hasTransparentOutputs;
  const valueBalance = data.valueBalanceIronwood || 0;
  const hasShielded = hasIronwood;
  const isShielding = hasTransparentInputs && !hasTransparentOutputs && valueBalance < 0;
  const isUnshielding = !hasTransparentInputs && hasTransparentOutputs && valueBalance > 0;

  const txType = isCoinbase
    ? 'COINBASE'
    : hasIronwood && !hasTransparent
      ? 'IRONWOOD'
      : hasIronwood && isShielding
        ? 'SHIELDING'
        : hasIronwood && isUnshielding
          ? 'UNSHIELDING'
          : hasIronwood && hasTransparent
            ? 'MIXED'
            : 'REGULAR';

  return {
    isCoinbase,
    hasIronwood,
    hasTransparentInputs,
    hasTransparentOutputs,
    hasTransparent,
    hasShielded,
    valueBalance,
    isShielding,
    isUnshielding,
    txType,
  };
}
