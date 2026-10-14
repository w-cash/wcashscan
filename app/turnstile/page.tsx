import { redirect } from 'next/navigation';

/** Compatibility URL: W.cash has Ironwood, not the legacy turnstile workflow. */
export default function TurnstileCompatibilityPage() {
  redirect('/ironwood');
}
