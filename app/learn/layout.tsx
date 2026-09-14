import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Learn Wcash: Privacy & Shielded Transactions | WcashExplorer',
  description: 'Learn how Wcash protects transaction privacy, how shielded addresses and pools work, and how to use WCASH safely with practical guides.',
  keywords: ['learn zcash', 'zcash guide', 'zcash tutorial', 'what is zcash', 'zcash privacy', 'zero knowledge proofs', 'zcash shielded transactions explained', 'WCASH beginner guide', 'zcash education'],
  path: '/learn',
  networks: ['mainnet'],
});

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
