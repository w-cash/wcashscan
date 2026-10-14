'use client';

import Link from 'next/link';
import { PrivacyRiskInline } from '@/components/PrivacyRiskInline';
import { Card, CardBody } from '@/components/ui/Card';
import { generateTxSummary } from './tx-summary';
import { TxHeroFlow } from './TxHeroFlow';
import type { TransactionData, TxClassification } from './types';

interface TxHeroCardProps {
  data: TransactionData;
  classification: TxClassification;
}

export function TxHeroCard({ data, classification }: TxHeroCardProps) {
  return (
    <div className="mb-6 animate-fade-in-up">
      <Card>
        <CardBody>
          <div className="space-y-3">
            <div className="flex justify-center">
              <TxHeroFlow data={data} classification={classification} />
            </div>

            <p className="text-sm text-muted leading-relaxed">
              {generateTxSummary(data, classification)}
              {data.blockHeight > 0 && (
                <>
                  {' '}
                  Included in canonical W.cash block{' '}
                  <Link href={`/block/${data.blockHeight}`} className="text-primary hover:underline">
                    #{data.blockHeight.toLocaleString()}
                  </Link>{' '}
                  with {data.confirmations.toLocaleString()} confirmation
                  {data.confirmations !== 1 ? 's' : ''}.
                </>
              )}
            </p>

            <PrivacyRiskInline txid={data.txid} variant="full" embedded />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
