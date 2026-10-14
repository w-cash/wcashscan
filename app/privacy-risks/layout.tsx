import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash Privacy Observations | WcashExplorer',
  description: 'Review public W.cash Ironwood amount and timing observations without inferring private recipients or wallet ownership.',
  keywords: ['W.cash privacy', 'WcashExplorer', 'Ironwood activity', 'TWC explorer'],
  path: '/privacy-risks',
  networks: ['mainnet'],
});

export default function PrivacyRisksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
