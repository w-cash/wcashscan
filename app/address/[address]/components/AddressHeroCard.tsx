'use client';

import type { ReactNode } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { CURRENCY } from '@/lib/config';
import type { AddressData } from './types';

interface AddressHeroCardProps {
  data: AddressData;
  summary: ReactNode;
}

export function AddressHeroCard({
  data,
  summary,
}: AddressHeroCardProps) {
  return (
    <div className="mb-6 animate-fade-in-up stagger-2">
      <Card>
        <CardBody>
          <div className="flex flex-col items-center text-center space-y-3 py-2">
            {/* Balance with Wcash icon */}
            <div>
              <div className="flex items-center justify-center gap-3">
                <img src="/logo.png" alt="TWC" className="w-7 h-7 sm:w-10 sm:h-10 rounded-full" />
                <span className="text-base sm:text-2xl font-bold font-mono text-primary">
                  {data.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} {CURRENCY}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted leading-relaxed max-w-lg">
              {summary}
            </p>

          </div>
        </CardBody>
      </Card>
    </div>
  );
}
