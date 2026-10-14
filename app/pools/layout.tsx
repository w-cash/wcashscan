import { getBaseUrl, buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash Value Pools | WcashExplorer',
  description: 'Track W.cash transparent and Ironwood supply, with public flow history and snapshot coverage.',
  path: '/pools',
  networks: ['mainnet'],
  index: true,
  imageAlt: 'WcashExplorer W.cash value pool statistics',
});

export default function PoolsLayout({ children }: { children: React.ReactNode }) {
  const url = `${getBaseUrl()}/pools`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: 'W.cash Value Pool Statistics',
    description: 'Transparent and Ironwood W.cash supply against the 21 million TWC ceiling, with public flow history.',
    isPartOf: { '@id': `${getBaseUrl()}/#website` },
    publisher: { '@id': `${getBaseUrl()}/#organization` },
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
    {children}
  </>;
}
