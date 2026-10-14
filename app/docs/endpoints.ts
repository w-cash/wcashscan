/**
 * Public W.cash API catalogue.
 *
 * Keep this list aligned with the routes mounted by server/api/server.js. It
 * intentionally documents W.cash fields only; legacy Zcash/CipherScan routes
 * are not part of the WcashExplorer contract.
 */
export interface ApiEndpoint {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  params: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }>;
  example: string;
  response: unknown;
  note?: string;
  category: string;
  id: string;
}

type EndpointSpec = Omit<ApiEndpoint, 'example'> & { example?: string };

const endpoint = (baseUrl: string, spec: EndpointSpec): ApiEndpoint => ({
  ...spec,
  example: spec.example || `curl '${baseUrl}${spec.path}'`,
});

export const getEndpoints = (baseUrl: string): EndpointSpec[] => [
  {
    id: 'health', category: 'System', method: 'GET', path: '/health',
    description: 'Liveness check for the WcashExplorer API process.', params: [],
    response: { ok: true, service: 'wcashexplorer-api', network: 'wcash-testnet' },
  },
  {
    id: 'health-deep', category: 'System', method: 'GET', path: '/health/deep',
    description: 'Readiness check for PostgreSQL, Wolf RPC, indexer freshness, and the configured network identity.', params: [],
    response: { ok: true, database: { healthy: true }, wolf: { healthy: true }, indexed: { height: 1234 } },
    note: 'A non-ready response is expected while the local node, database, or indexer is still starting.',
  },
  {
    id: 'config', category: 'System', method: 'GET', path: '/api/config',
    description: 'Returns the active W.cash network profile, API source, preview mode, and feature gates.', params: [],
    response: { network: 'wcash-testnet', chain: 'testnet', ticker: 'TWC', apiBaseUrl: baseUrl, source: 'wcash-api' },
  },
  {
    id: 'info', category: 'System', method: 'GET', path: '/api/info',
    description: 'Returns indexed W.cash chain tip and service metadata.', params: [],
    response: { network: 'wcash-testnet', chain: 'testnet', blocks: 1234, bestBlockHash: '…' },
  },
  {
    id: 'pulse', category: 'System', method: 'GET', path: '/api/pulse',
    description: 'Compact live pulse containing chain tip, peers, mempool, and service freshness.', params: [],
    response: { network: 'wcash-testnet', tip: 1234, peers: 8, mempool: { count: 0 } },
  },
  {
    id: 'blocks', category: 'Blocks', method: 'GET', path: '/api/blocks',
    description: 'Paginated canonical W.cash blocks.', params: [
      { name: 'limit', type: 'number', description: 'Number of rows, up to the deployment limit.' },
      { name: 'offset', type: 'number', description: 'Rows to skip.' },
    ], response: { blocks: [{ height: 1234, hash: '…', transaction_count: 2, size: 321 }], pagination: { limit: 10, offset: 0, total: 1234 } },
  },
  {
    id: 'block', category: 'Blocks', method: 'GET', path: '/api/block/:heightOrHash',
    description: 'Detailed canonical block with transparent and Ironwood transaction data.', params: [
      { name: 'heightOrHash', type: 'number|string', description: 'Block height or 64-character block hash.', required: true },
    ], response: { height: 1234, hash: '…', previousBlockHash: '…', transactionCount: 2, transactions: [] },
  },
  {
    id: 'recent-blocks', category: 'Blocks', method: 'GET', path: '/api/network/blocks/recent',
    description: 'Recent blocks with W.cash miner reward and fee fields.', params: [
      { name: 'limit', type: 'number', description: 'Number of blocks to return.' },
    ], response: { success: true, blocks: [{ height: 1234, minerRewardTwc: null, feesTwc: '0' }] },
  },
  {
    id: 'anchor-search', category: 'Blocks', method: 'GET', path: '/api/search/anchor/:root',
    description: 'Search the indexed Ironwood commitment root. Other shielded-pool roots are not part of W.cash.', params: [
      { name: 'root', type: 'string', description: '64-character commitment root.', required: true },
    ], response: { success: true, available: true, matches: [] },
  },
  {
    id: 'transactions', category: 'Transactions', method: 'GET', path: '/api/transactions/list',
    description: 'Paginated W.cash transactions with transparent and Ironwood activity flags.', params: [
      { name: 'limit', type: 'number', description: 'Number of rows.' },
      { name: 'offset', type: 'number', description: 'Rows to skip.' },
      { name: 'type', type: 'string', description: 'Optional transparent, shielded, mixed, or coinbase filter.' },
    ], response: { transactions: [{ txid: '…', block_height: 1234, has_ironwood: false, type: 'transparent' }] },
  },
  {
    id: 'transaction', category: 'Transactions', method: 'GET', path: '/api/tx/:txid',
    description: 'Transaction detail from the W.cash index, including public inputs/outputs and Ironwood counts.', params: [
      { name: 'txid', type: 'string', description: '64-character transaction id.', required: true },
    ], response: { txid: '…', blockHeight: 1234, feeZat: '10000', inputs: [], outputs: [], ironwood: { actions: 0 } },
  },
  {
    id: 'transaction-raw', category: 'Transactions', method: 'GET', path: '/api/tx/:txid/raw',
    description: 'Raw W.cash transaction bytes when the configured node exposes them.', params: [
      { name: 'txid', type: 'string', description: '64-character transaction id.', required: true },
    ], response: { txid: '…', hex: '…' },
  },
  {
    id: 'transaction-verbose', category: 'Transactions', method: 'GET', path: '/api/tx/:txid/verbose',
    description: 'Verbose Wolf transaction response. The API preserves W.cash-native fields and does not invent legacy pool fields.', params: [
      { name: 'txid', type: 'string', description: '64-character transaction id.', required: true },
    ], response: { txid: '…', vin: [], vout: [], ironwood: { actions: [] } },
  },
  {
    id: 'mempool', category: 'Transactions', method: 'GET', path: '/api/mempool',
    description: 'Current Wolf mempool normalized to W.cash transparent and Ironwood activity.', params: [],
    response: { count: 0, transactions: [], network: 'wcash-testnet' },
  },
  {
    id: 'mempool-transaction', category: 'Transactions', method: 'GET', path: '/api/mempool/tx/:txid',
    description: 'One pending W.cash transaction from the Wolf mempool.', params: [
      { name: 'txid', type: 'string', description: '64-character transaction id.', required: true },
    ], response: { txid: '…', status: 'pending', hasIronwood: false },
  },
  {
    id: 'network-stats', category: 'Network', method: 'GET', path: '/api/network/stats',
    description: 'Current chain height, timing, fees, and Wolf-derived network metrics.', params: [],
    response: { height: 1234, blockTime: 75, networkHashrate: null, currentSubsidyTwc: null },
    note: 'Hashrate and reward values are unavailable rather than fabricated when Wolf does not provide them.',
  },
  {
    id: 'network-health', category: 'Network', method: 'GET', path: '/api/network/health',
    description: 'Wolf RPC and indexed-chain health for the active W.cash network.', params: [],
    response: { wolf: { healthy: true }, database: { healthy: true }, indexer: { healthy: true } },
  },
  {
    id: 'network-peers', category: 'Network', method: 'GET', path: '/api/network/peers',
    description: 'Peer observations returned by Wolf.', params: [],
    response: { peers: [], count: 0, source: 'wolf-rpc' },
  },
  {
    id: 'network-halving', category: 'Network', method: 'GET', path: '/api/network/halving',
    description: 'W.cash subsidy schedule and next halving height.', params: [],
    response: { height: 1234, currentSubsidyZat: null, nextHalvingHeight: 1680000 },
  },
  {
    id: 'hashrate-history', category: 'Network', method: 'GET', path: '/api/network/hashrate-history',
    description: 'Indexed block-count history plus Wolf solution-rate observations when available.', params: [
      { name: 'days', type: 'number', description: 'History window.' },
    ], response: { available: false, data: [], source: 'wolf-rpc' },
  },
  {
    id: 'protocol-stats', category: 'Network', method: 'GET', path: '/api/network/protocol-stats',
    description: 'W.cash protocol/version observations from indexed blocks.', params: [],
    response: { data: [], available: true },
  },
  {
    id: 'emission', category: 'Network', method: 'GET', path: '/api/network/emission',
    description: 'W.cash issuance observations and subsidy schedule.', params: [
      { name: 'days', type: 'number', description: 'History window.' },
    ], response: { network: 'wcash-testnet', data: [], maxSupplyTwc: '21000000' },
  },
  {
    id: 'supply', category: 'Network', method: 'GET', path: '/api/supply',
    description: 'Current W.cash supply from Wolf and indexed transparent/Ironwood accounting.', params: [],
    response: { supplyZat: null, transparentZat: null, ironwoodZat: null, maxSupplyZat: '2100000000000000' },
  },
  {
    id: 'chain-size', category: 'Network', method: 'GET', path: '/api/network/chain-size-history',
    description: 'Exact serialized-byte totals from indexed W.cash blocks.', params: [
      { name: 'days', type: 'number', description: 'History window.' },
    ], response: { data: [], available: true, unit: 'bytes' },
  },
  {
    id: 'address', category: 'Addresses', method: 'GET', path: '/api/address/:address',
    description: 'Transparent W.cash address activity and balance. Private receivers are not decoded into ownership data.', params: [
      { name: 'address', type: 'string', description: 'W.cash transparent or supported unified address.', required: true },
    ], response: { address: 'W1…', balanceZat: '0', transactions: [] },
  },
  {
    id: 'rich-list', category: 'Addresses', method: 'GET', path: '/api/rich-list',
    description: 'Ranked public transparent addresses from the indexed chain.', params: [
      { name: 'limit', type: 'number', description: 'Number of addresses.' },
    ], response: { addresses: [{ rank: 1, address: 'W1…', balanceZat: '0' }] },
  },
  {
    id: 'transparent-exposed', category: 'Addresses', method: 'GET', path: '/api/transparent/exposed',
    description: 'Transparent address reuse and exposure observations; no private recipient inference.', params: [],
    response: { available: true, addresses: [] },
  },
  {
    id: 'ironwood-overview', category: 'Ironwood', method: 'GET', path: '/api/ironwood/overview',
    description: 'Ironwood activity and accounting overview for W.cash.', params: [],
    response: { network: 'wcash-testnet', actions: 0, balanceZat: '0', available: true },
  },
  {
    id: 'privacy-risks', category: 'Ironwood privacy', method: 'GET', path: '/api/privacy/risks',
    description: 'Conservative public-amount/day heuristic observations. It never claims private ownership.', params: [],
    response: { available: true, risks: [] },
  },
  {
    id: 'privacy-linkage', category: 'Ironwood privacy', method: 'GET', path: '/api/privacy/linkage-edges',
    description: 'Public linkage edges derived from transparent/Ironwood observations where supported.', params: [],
    response: { available: true, edges: [] },
  },
  {
    id: 'privacy-common-amounts', category: 'Ironwood privacy', method: 'GET', path: '/api/privacy/common-amounts',
    description: 'Repeated public amount observations in TWC/zatoshi units.', params: [],
    response: { available: true, amounts: [] },
  },
  {
    id: 'privacy-batch-risks', category: 'Ironwood privacy', method: 'GET', path: '/api/privacy/batch-risks',
    description: 'Batch-level public amount/day risk observations.', params: [],
    response: { available: true, batches: [] },
  },
  {
    id: 'mining-pool-distribution', category: 'Mining', method: 'GET', path: '/api/mining/pool-distribution',
    description: 'Miner attribution from W.cash coinbase tags or explicit operator configuration.', params: [],
    response: { available: true, pools: [], attribution: 'coinbase-or-operator-config' },
  },
  {
    id: 'mining-pool-ranking', category: 'Mining', method: 'GET', path: '/api/mining/pool-ranking',
    description: 'Ranked W.cash miner attribution for the selected period.', params: [
      { name: 'period', type: 'string', description: 'all, 30d, 7d, or 24h.' },
    ], response: { available: true, ranking: [] },
  },
  {
    id: 'mining-hashrate-share', category: 'Mining', method: 'GET', path: '/api/mining/hashrate-share',
    description: 'Observed miner shares from indexed coinbase attribution.', params: [],
    response: { available: true, shares: [] },
  },
  {
    id: 'mining-rewards', category: 'Mining', method: 'GET', path: '/api/mining/rewards',
    description: 'Observed public coinbase rewards, with unknown attribution kept explicit.', params: [],
    response: { available: true, rewards: [] },
  },
  {
    id: 'mining-behavior', category: 'Mining', method: 'GET', path: '/api/mining/miner-behavior',
    description: 'Public earned/moved/held observations. Private wallet behaviour is not inferred.', params: [],
    response: { available: false, miners: [], note: 'Requires indexed W.cash attribution data.' },
  },
  {
    id: 'mining-network-hashrate', category: 'Mining', method: 'GET', path: '/api/mining/network-hashrate',
    description: 'Current Wolf getnetworksolps result.', params: [],
    response: { available: false, solutionRate: null, source: 'wolf-rpc' },
  },
  {
    id: 'pool-overview', category: 'Mining', method: 'GET', path: '/api/pools/overview',
    description: 'W.cash transparent and Ironwood balance coverage.', params: [],
    response: { transparent: { balanceZat: '0' }, ironwood: { balanceZat: '0' }, coverage: { available: true } },
  },
  {
    id: 'pool-flows', category: 'Mining', method: 'GET', path: '/api/pools/flows',
    description: 'Daily transparent/Ironwood public flow observations.', params: [
      { name: 'days', type: 'number', description: 'History window.' },
    ], response: { data: [], available: true },
  },
  {
    id: 'network-fee-distribution', category: 'Mining', method: 'GET', path: '/api/network/fee-distribution',
    description: 'Indexed W.cash transaction fee distribution.', params: [
      { name: 'days', type: 'number', description: 'History window.' },
    ], response: { data: [], available: true, unit: 'zatoshi' },
  },
];

export const getEndpointsByCategory = (baseUrl: string) => {
  const grouped = new Map<string, ApiEndpoint[]>();
  for (const item of getEndpoints(baseUrl)) {
    const rows = grouped.get(item.category) || [];
    rows.push(endpoint(baseUrl, item));
    grouped.set(item.category, rows);
  }
  return Array.from(grouped, ([name, endpoints]) => ({ name, endpoints }));
};
