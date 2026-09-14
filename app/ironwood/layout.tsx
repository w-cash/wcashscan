import type { Metadata } from 'next';
import { buildPageMetadata, getNetwork } from '@/lib/seo';

export function generateMetadata(): Metadata {
  if (getNetwork() === 'crosslink-testnet') {
    return {
      title: 'Page Not Found | WcashExplorer',
      description: 'This Wcash Ironwood tracker is not available on the Crosslink deployment.',
      robots: { index: false, follow: false },
    };
  }

  return buildPageMetadata({
    title: 'Wcash Ironwood Upgrade & Migration Tracker | WcashExplorer',
    description:
      'Track the Wcash Ironwood (NU6.3) activation, Orchard migration, Ironwood shielded supply, and observable turnstile activity on WcashExplorer.',
    keywords: [
      'Wcash Ironwood',
      'Ironwood Wcash',
      'Wcash Ironwood upgrade',
      'NU6.3',
      'Ironwood migration',
      'Orchard to Ironwood',
      'Wcash migration tracker',
    ],
    path: '/ironwood',
    imageAlt: 'WcashExplorer Wcash Ironwood upgrade and migration tracker',
    networks: ['mainnet'],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
