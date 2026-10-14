import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Ironwood Activity | WcashExplorer',
  description: 'W.cash Ironwood value-pool activity.',
  path: '/turnstile',
  networks: ['mainnet', 'testnet'],
});

export default function TurnstileCompatibilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
