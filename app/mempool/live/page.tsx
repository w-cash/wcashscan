import { Metadata } from 'next';
import MempoolLiveClient from './MempoolLiveClient';

export const metadata: Metadata = {
  title: 'Mempool Live — Wcash Network Screensaver | WcashExplorer',
  description: 'Watch Wcash transactions flow in real time. A full-screen ambient visualization of the mempool — perfect for dashboards and passive monitoring.',
  robots: { index: true, follow: true },
};

export default function MempoolLivePage() {
  return <MempoolLiveClient />;
}
