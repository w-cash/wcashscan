import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Network Stats & Node Map | WcashExplorer',
  description: 'Track Wcash network health with live node locations, hashrate, difficulty, peer counts, and blockchain statistics.',
  keywords: ['wcash network stats', 'wcash node map', 'wcash hashrate', 'wcash peers', 'wcash nodes', 'WCASH network', 'wcash difficulty', 'wcash blockchain stats'],
  path: '/network',
});

export default function NetworkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
