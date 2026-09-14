import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Privacy Dashboard & Shielded Pools | WcashExplorer',
  description: 'Track Wcash privacy with live Orchard, Sapling, and Ironwood pool sizes, shielded transaction activity, and WcashExplorer privacy metrics.',
  keywords: ['zcash privacy', 'zcash shielded pool', 'zcash privacy score', 'sapling pool', 'orchard pool', 'zcash shielded transactions', 'WCASH privacy stats', 'zcash privacy dashboard'],
  path: '/privacy',
  networks: ['mainnet'],
});

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
