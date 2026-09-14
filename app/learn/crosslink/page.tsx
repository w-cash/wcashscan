import { CrosslinkLearn } from '@/components/CrosslinkLearn';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Learn Crosslink - PoW+PoS Finality, Staking & Seasons | WcashExplorer',
  description: 'Learn how Crosslink works: hybrid PoW/PoS finality, staking days, finalizers, delegation bonds, and how to earn real WCASH by participating in Season 1.',
  keywords: ['crosslink', 'zcash crosslink', 'proof of stake', 'finality', 'staking', 'finalizer', 'cTWC', 'zcash staking'],
  path: '/learn/crosslink',
  index: false,
});

export default function CrosslinkLearnPage() {
  return <CrosslinkLearn />;
}
