export interface TransactionInput {
  address?: string | null;
  value?: number;
  prev_txid?: string | null;
  prev_vout?: number | null;
  coinbase?: string | boolean | null;
  txid?: string | null;
  vout?: number | null;
}

export interface TransactionOutput {
  address?: string | null;
  value?: number;
  vout_index?: number;
  n?: number;
  spent?: boolean;
  scriptPubKey?: { hex?: string; addresses?: string[] };
}

export interface TransactionData {
  txid: string;
  status?: 'confirmed' | 'stale' | 'unknown';
  isCanonical?: boolean;
  blockHeight: number;
  blockHash: string | null;
  timestamp: number;
  confirmations: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  totalInput: number;
  totalInputZat?: string | null;
  totalOutput: number;
  totalOutputZat?: string | null;
  fee: number;
  feeZat?: string | null;
  size: number;
  version: number;
  locktime: number;
  expiryHeight: number | null;
  isCoinbase?: boolean;
  hasIronwood: boolean;
  ironwoodActions: number;
  valueBalanceIronwood?: number;
  valueBalanceIronwoodZat?: string | null;
  coinbaseHex?: string | null;
  coinbaseText?: string | null;
}

export type TxType =
  | 'COINBASE'
  | 'IRONWOOD'
  | 'SHIELDING'
  | 'UNSHIELDING'
  | 'MIXED'
  | 'REGULAR';

export type LookupState = 'available' | 'missing' | 'unavailable' | null;

export type ActiveTab = 'summary' | 'io' | 'raw';

export interface TxClassification {
  isCoinbase: boolean;
  hasIronwood: boolean;
  hasTransparentInputs: boolean;
  hasTransparentOutputs: boolean;
  hasTransparent: boolean;
  hasShielded: boolean;
  valueBalance: number;
  isShielding: boolean;
  isUnshielding: boolean;
  txType: TxType;
}

export interface RawTxData {
  hex: string;
  decoded: unknown;
}
