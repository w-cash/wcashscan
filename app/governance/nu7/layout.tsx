import type { Metadata } from 'next';
import { buildPageMetadata, getNetwork } from '@/lib/seo';

export function generateMetadata(): Metadata {
  const network = getNetwork();
  if (network !== 'mainnet') {
    return {
      title: 'Page Not Found | WcashExplorer',
      description: 'The NU7 vote tracker is only available on mainnet.',
      robots: { index: false, follow: false },
    };
  }

  return buildPageMetadata({
    title: 'NU7 Coinholder Vote — Wcash Governance | WcashExplorer',
    description:
      'Follow the Wcash NU7 coinholder vote: issuance smoothing, Sprout deprecation, 25-second blocks, and upgrade schedule. Live countdown, poll questions, and verified results on WcashExplorer.',
    keywords: [
      'Wcash NU7',
      'Wcash governance',
      'NU7 vote',
      'coinholder vote',
      'Wcash upgrade',
      'NSM issuance',
      'Sprout deprecation',
      'ZIP 218',
    ],
    path: '/governance/nu7',
    imageAlt: 'WcashExplorer NU7 coinholder vote tracker',
    networks: ['mainnet'],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
