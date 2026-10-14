import UnitConverterClient from './UnitConverterClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'TWC / Zatoshi Unit Converter | WcashExplorer',
  description: 'Convert between TWC and zatoshi (1 TWC = 100,000,000 zatoshi) using local integer arithmetic.',
  keywords: [
    'W.cash unit converter',
    'TWC to zatoshi',
    'zatoshi to TWC',
    'W.cash developer tool',
  ],
  path: '/tools/unit-converter',
  networks: ['mainnet'],
});

export default function UnitConverterPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-in">
      <UnitConverterClient />
    </div>
  );
}
