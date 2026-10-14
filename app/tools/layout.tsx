import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'W.cash Developer Tools | WcashExplorer',
  description: 'Read-only W.cash developer tools and API documentation.',
  keywords: ['W.cash developer tools', 'TWC converter', 'W.cash API'],
  path: '/tools',
});

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
