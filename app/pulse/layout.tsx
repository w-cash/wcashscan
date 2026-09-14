import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Network Pulse — Statistical Anomaly Feed | WcashExplorer',
  description:
    'Auto-detected on-chain anomalies for Wcash: unusual transaction volumes, shielding spikes, cross-chain flows, fee surges, and valuation signals.',
  keywords: [
    'zcash anomalies',
    'zcash pulse',
    'zcash on-chain events',
    'zcash network activity',
    'zcash statistical events',
  ],
  path: '/pulse',
  networks: ['mainnet'],
  imageAlt: 'WcashExplorer Wcash network pulse — anomaly feed',
});

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
