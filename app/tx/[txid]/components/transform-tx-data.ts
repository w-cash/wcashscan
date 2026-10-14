import { zatToTwc } from '@/lib/format-numbers';
import type { TransactionData } from './types';

function integer(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function transformExpressTxData(txData: any): TransactionData {
  const transformedInputs = (txData.inputs || []).map((input: any) => ({
    ...input,
    value: input.value == null ? 0 : zatToTwc(input.value),
    txid: input.prev_txid,
    vout: input.prev_vout,
  }));

  const transformedOutputs = (txData.outputs || []).map((output: any) => ({
    ...output,
    value: output.value == null ? 0 : zatToTwc(output.value),
    n: output.vout_index,
    spent: Boolean(output.spent),
    scriptPubKey: {
      hex: output.script_pubkey || '',
      addresses: output.address ? [output.address] : [],
    },
  }));

  const transparentInputSum = transformedInputs.reduce((sum: number, input: any) => sum + (input.value || 0), 0);
  const transparentOutputSum = transformedOutputs.reduce((sum: number, output: any) => sum + (output.value || 0), 0);

  return {
    txid: txData.txid,
    status: txData.status,
    isCanonical: txData.isCanonical,
    blockHeight: integer(txData.blockHeight),
    blockHash: txData.blockHash || null,
    timestamp: integer(txData.blockTime),
    confirmations: integer(txData.confirmations),
    inputs: transformedInputs,
    outputs: transformedOutputs,
    totalInput: txData.totalInput == null ? transparentInputSum : Number(txData.totalInput),
    totalInputZat: txData.totalInputZat ?? null,
    totalOutput: txData.totalOutput == null ? transparentOutputSum : Number(txData.totalOutput),
    totalOutputZat: txData.totalOutputZat ?? null,
    fee: txData.fee == null ? 0 : Number(txData.fee),
    feeZat: txData.feeZat ?? null,
    size: integer(txData.size),
    version: integer(txData.version),
    locktime: integer(txData.locktime),
    expiryHeight: txData.expiryHeight == null ? null : integer(txData.expiryHeight),
    isCoinbase: Boolean(txData.isCoinbase),
    hasIronwood: Boolean(txData.hasIronwood),
    ironwoodActions: integer(txData.ironwoodActions),
    valueBalanceIronwood: txData.valueBalanceIronwood == null ? undefined : Number(txData.valueBalanceIronwood),
    valueBalanceIronwoodZat: txData.valueBalanceIronwoodZat ?? null,
    coinbaseHex: txData.coinbaseHex || null,
    coinbaseText: txData.coinbaseText || null,
  };
}
