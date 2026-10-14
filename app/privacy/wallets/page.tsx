import { WcashUnavailable } from '@/components/WcashUnavailable';

export default function WalletsPage() {
  return <WcashUnavailable title="Wallet fingerprint analysis is unavailable" detail="WcashExplorer does not infer wallet identity from fee lanes, action padding, or private transaction patterns. A W.cash-native heuristic specification must be reviewed before this route can expose data." />;
}
