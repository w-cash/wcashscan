import { getBaseUrl, buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Shielded Pool Statistics | WcashExplorer',
  description: 'Track WCASH across the Ironwood, Orchard, Sapling, Sprout, and transparent pools, with shielded supply and flow history.',
  path: '/pools',
  networks: ['mainnet'],
  index: true,
  imageAlt: 'WcashExplorer Wcash shielded pool statistics',
});

export default function PoolsLayout({ children }: { children: React.ReactNode }) {
  const url = `${getBaseUrl()}/pools`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: 'Wcash Shielded Pool Statistics',
    description: 'Public supply (transparent balances and other issued value), shielded and unmined WCASH against the 21 million cap, with pool history and public flows.',
    isPartOf: { '@id': `${getBaseUrl()}/#website` },
    publisher: { '@id': `${getBaseUrl()}/#organization` },
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
    {children}
  </>;
}
