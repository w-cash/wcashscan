/**
 * Product identity for this deployment.
 *
 * The scanner UI and application logic come from w-cash/wcashscan. Keep the
 * product name and repository link in one place so a future network rollout
 * does not reintroduce the upstream fork's old branding.
 */
export const BRAND_NAME = 'WcashExplorer';
export const BRAND_WORDMARK = 'WCASHEXPLORER';
export const SCANNER_REPOSITORY_URL = 'https://github.com/w-cash/wcashscan';

/** Build-time stable URL for client-side share text and generated cards. */
export function getPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`;
}
