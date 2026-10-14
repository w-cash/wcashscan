'use client';

import type { AddressTab } from './types';

interface AddressTabBarProps {
  activeTab: AddressTab;
  totalTxCount: number;
  showGraph?: boolean;
  onTabChange: (tab: AddressTab) => void;
}

export function AddressTabBar({
  activeTab,
  totalTxCount,
  onTabChange,
}: AddressTabBarProps) {
  return (
    <div id="transactions-section" className="mb-6 md:mb-8 animate-fade-in-up stagger-3">
      <div className="flex items-center gap-6 border-b border-cipher-border mb-0">
        <button
          onClick={() => onTabChange('transactions')}
          className={`pb-2 font-mono text-xs tracking-wider uppercase transition-colors ${
            activeTab === 'transactions'
              ? 'text-primary border-b-2 border-cipher-cyan -mb-[1px]'
              : 'text-muted hover:text-secondary'
          }`}
        >
          Transactions <span className="ml-1 text-[10px] opacity-70">{totalTxCount}</span>
        </button>
      </div>
    </div>
  );
}
