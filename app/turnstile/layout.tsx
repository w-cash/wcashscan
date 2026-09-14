import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Wcash Turnstile Tracker | WcashExplorer',
  description:
    'Track where deshielded WCASH goes: transparent addresses, reshielding, exchanges, and other transfers. Updated hourly.',
  keywords: [
    'zcash turnstile',
    'zcash deshielding',
    'zcash shielded pool',
    'deshielded WCASH',
    'zcash exchange flow',
    'zcash privacy analytics',
    'WCASH turnstile tracker',
    'WcashExplorer',
  ],
  path: '/turnstile',
  imageAlt: 'WcashExplorer Turnstile Tracker — Wcash deshielding analytics',
  networks: ['mainnet'],
});

export default function TurnstileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
