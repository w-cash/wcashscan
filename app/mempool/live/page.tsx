import { Metadata } from 'next';
import MempoolLiveClient from './MempoolLiveClient';

export const metadata: Metadata = {
  title: 'Mempool Live — W.cash Network Screensaver | WcashExplorer',
  description: 'Watch W.cash transactions flow in real time. A full-screen ambient visualization of the mempool for dashboards and passive monitoring.',
  robots: { index: true, follow: true },
};

export default function MempoolLivePage() {
  return <MempoolLiveClient />;
}
