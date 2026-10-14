/**
 * Single source of truth for node/client color coding across the site.
 * Previously NodeMap, NodesClient, and TopologyGraph each hard-coded their
 * own (inconsistent) client -> color maps, so the same W.cash client
 * rendered a different color depending on which page you were on.
 */

export const CLIENT_COLORS: Record<string, string> = {
  Wolf: '#56D4C8',
  Seeder: '#9B8AFB',
  Other: '#7D8A9A',
  Unknown: '#4B5563',
  Unidentified: '#4B5563',
};

/** The crawler stores nodes with no advertised user-agent as "Unknown"; present
 * them honestly as "Unidentified" (reachable, but did not advertise a client). */
export function clientLabel(client: string | null | undefined): string {
  if (!client || client === 'Unknown') return 'Unidentified';
  if (/^(?:zebra|zakura|zcashd|magicbean)$/i.test(client)) return 'Other';
  return client;
}

export function clientColor(client: string | null | undefined): string {
  const key = client || 'Unknown';
  return CLIENT_COLORS[key] || CLIENT_COLORS.Other;
}

export const CLIENT_BADGE_CLASSES: Record<string, string> = {
  Wolf: 'bg-[#56D4C8]/15 text-[#56D4C8] border-[#56D4C8]/30',
  Seeder: 'bg-[#9B8AFB]/15 text-[#9B8AFB] border-[#9B8AFB]/30',
  Other: 'bg-[#7D8A9A]/15 text-[#7D8A9A] border-[#7D8A9A]/30',
  Unknown: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  Unidentified: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export function clientBadgeClass(client: string | null | undefined): string {
  const key = client || 'Unknown';
  return CLIENT_BADGE_CLASSES[key] || CLIENT_BADGE_CLASSES.Other;
}

/**
 * Stable-ish palette for "top ISP per location" style views (Concentration
 * Risk, Infra map lens). ISPs are assigned colors by frequency rank within a
 * given dataset, so the mapping is only stable within one render/session —
 * that's fine, we're not persisting it anywhere.
 */
const ISP_PALETTE = [
  '#56D4C8', '#E8C48D', '#5B9CF6', '#a78bfa', '#f59e0b',
  '#22c55e', '#ef4444', '#ec4899', '#14b8a6', '#64748b',
];
export const ISP_OTHER_COLOR = '#4B5563';
export const ISP_UNRESOLVED_COLOR = '#374151';

export function buildIspColorMap(ispsRankedByFrequency: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  ispsRankedByFrequency.forEach((isp, i) => {
    if (isp === 'Unresolved') {
      map[isp] = ISP_UNRESOLVED_COLOR;
      return;
    }
    map[isp] = i < ISP_PALETTE.length ? ISP_PALETTE[i] : ISP_OTHER_COLOR;
  });
  return map;
}
