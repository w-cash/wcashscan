import { WcashUnavailable } from '@/components/WcashUnavailable';

export default function BlendCheckPage() {
  return (
    <WcashUnavailable
      title="Amount blending is unavailable"
      detail="WcashExplorer reports transparent and Ironwood flow observations, but it does not claim that an amount blends into a private set or identify wallet ownership."
    />
  );
}
