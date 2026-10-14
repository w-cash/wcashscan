export interface Transaction {
  txid: string;
  timestamp: number;
  amount: number;
  type: 'received' | 'sent';
  blockHeight?: number;
  from?: string | null;
  to?: string | null;
  isCoinbase?: boolean;
  isIronwood?: boolean;
  isDeshielding?: boolean;
  isShielding?: boolean;
}

export interface AddressData {
  address: string;
  balance: number;
  type: 'transparent' | 'unified';
  transactions: Transaction[];
  transactionCount?: number;
  note?: string;
  firstSeen?: number | null;
  lastSeen?: number | null;
  firstFunding?: FirstFunding | null;
}

export interface FirstFunding {
  txid: string;
  blockTime: number;
  amountTwc: number;
  funderAddress: string | null;
  funderLabel: string | null;
  isCoinbase: boolean;
}

export type AddressTab = 'transactions';
