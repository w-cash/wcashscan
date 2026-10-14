import { ChartsClient } from './ChartsClient';
import { getApiUrl } from '@/lib/api-config';

const API_BASE = getApiUrl();

async function fetchJson(path: string): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function label(value: string | Date | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchChartData() {
  const [privacy, pools, flows, hashrateShare, anonymity, shielding, fees, mining, behavior, hashrateHistory, emission, chainSize, protocol] = await Promise.all([
    fetchJson('/api/privacy-stats?days=30'),
    fetchJson('/api/network/pool-history?period=all'),
    fetchJson('/api/pools/flows?period=30d&pool=ironwood'),
    fetchJson('/api/mining/hashrate-share?period=30d'),
    fetchJson('/api/analytics/anonymity-set?period=30d'),
    fetchJson('/api/analytics/shielding-distribution?period=30d'),
    fetchJson('/api/network/fee-distribution?period=30d'),
    fetchJson('/api/mining/pool-distribution?period=30d'),
    fetchJson('/api/mining/miner-behavior?period=30d'),
    fetchJson('/api/mining/hashrate-history?period=30d'),
    fetchJson('/api/network/emission?period=1y'),
    fetchJson('/api/network/chain-size-history?period=1y'),
    fetchJson('/api/network/protocol-stats'),
  ]);

  const data: Record<string, any[]> = {};
  const trends = Array.isArray(privacy?.trends?.daily) ? privacy.trends.daily.slice(-30) : [];
  if (trends.length) {
    data['privacy-adoption'] = trends.map((point: any) => ({ label: label(point.date), shieldedPct: number(point.shieldedPercentage) }));
    data['daily-activity'] = trends.map((point: any) => ({ label: label(point.date), shielded: number(point.shielded), transparent: number(point.transparent) }));
  }

  const poolPoints = Array.isArray(pools?.points) ? pools.points : [];
  if (poolPoints.length) {
    data['pool-growth'] = poolPoints.map((point: any) => ({ label: label(point.date), ironwood: number(point.ironwood) }));
    data['pool-balances'] = poolPoints.map((point: any) => ({ label: label(point.date), ironwood: number(point.ironwood), transparent: number(point.transparent) }));
  }

  const flowPoints = Array.isArray(flows?.points) ? flows.points.slice(-30) : [];
  if (flowPoints.length) {
    data['flow-volume'] = flowPoints.map((point: any) => ({ label: label(point.date), shield: number(point.shield), deshield: number(point.deshield), net: number(point.net) }));
  }

  if (Array.isArray(anonymity?.thresholds)) {
    data['anonymity-set'] = anonymity.thresholds.map((point: any) => ({ label: `${number(point.thresholdTwc)} TWC`, shieldCount: number(point.shieldCount), deshieldCount: number(point.deshieldCount) }));
  }
  if (Array.isArray(shielding?.buckets)) {
    data['shielding-dist'] = shielding.buckets.map((point: any) => ({ label: point.label || '', count: number(point.shieldCount) + number(point.deshieldCount) }));
  }
  if (Array.isArray(fees?.daily)) {
    data['fee-dist'] = fees.daily.slice(-30).map((point: any) => ({ label: label(point.date), median: number(point.median) / 1e8 }));
  }
  if (Array.isArray(mining?.pools)) {
    data['mining-dist'] = mining.pools.slice(0, 10).map((point: any) => ({ label: point.name || 'Unknown', blocks: number(point.blocks) }));
  }
  if (Array.isArray(hashrateShare?.series)) {
    data['hashrate-share'] = hashrateShare.series.slice(-30).map((point: any) => ({
      label: label(point.date),
      share: Math.max(...Object.values(point.pools || {}).map(number), 0) * 100,
    }));
  }
  if (Array.isArray(behavior?.series)) {
    data['miner-behavior'] = behavior.series.slice(-30).map((point: any) => ({ label: label(point.date), moved: number(point.movedZat) / 1e8, held: number(point.heldZat) / 1e8 }));
  }
  if (Array.isArray(hashrateHistory?.points)) {
    data['network-hashrate'] = hashrateHistory.points.slice(-30).map((point: any) => ({ label: label(point.date), hashrate: number(point.solutionRate) }));
  }
  if (Array.isArray(emission?.supplyHistory)) {
    data['supply-emission'] = emission.supplyHistory.map((point: any) => ({ label: label(point.date), supply: number(point.circulating) }));
  }
  if (Array.isArray(chainSize?.points)) {
    data['chain-size'] = chainSize.points.map((point: any) => ({ label: label(point.time), sizeGb: number(point.sizeGB) }));
  }
  if (Array.isArray(protocol?.history)) {
    data['protocol-stats'] = protocol.history.map((point: any) => ({ label: label(point.date), actions: number(point.ironwoodActions) }));
  }

  return data;
}

async function fetchActivitySummary() {
  const [pulse, risks] = await Promise.all([fetchJson('/api/pulse/summary?days=7'), fetchJson('/api/privacy/risks?limit=1&period=7d')]);
  const stats = risks?.stats || {};
  return {
    up: number(pulse?.up),
    down: number(pulse?.down),
    high: number(stats.highRisk),
    medium: number(stats.mediumRisk),
    low: number(stats.lowRisk),
    total: number(stats.total),
  };
}

export default async function ChartsPage() {
  const [chartData, activitySummary] = await Promise.all([fetchChartData(), fetchActivitySummary()]);
  return <ChartsClient initialData={chartData} activitySummary={activitySummary} />;
}
