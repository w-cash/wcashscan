import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Privacy Risk Analysis | WcashExplorer',
  description: 'Find Wcash transactions with timing, amount, deshielding, or batch patterns that may reduce privacy. Explore risk signals on WcashExplorer.',
  keywords: ['zcash privacy risk', 'zcash deshielding', 'zcash batch detection', 'zcash transaction analysis', 'zcash privacy intelligence', 'WCASH privacy scanner', 'zcash round trip detection'],
  path: '/privacy-risks',
  networks: ['mainnet'],
});

export default function PrivacyRisksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
