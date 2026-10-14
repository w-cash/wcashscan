-- Local W.cash regtest identity used by deterministic preflight and E2E runs.
-- This does not alter the production/testnet profile; it lets one schema
-- prove that the API/indexer reject a node from the wrong network.
INSERT INTO wcash_chain_identity (
    profile_id, chain, ticker, genesis_hash, post_genesis_branch_id,
    target_spacing_seconds, halving_interval, monetary_ceiling_zatoshi, source
) VALUES (
    'wcash-regtest', 'WcashRegtest', 'TWC',
    '70bf0bab17eff361a6331bb825b3b7253c8c96ff96407f948161d2912658bb1c',
    'c3a6678a', 75, 1680000, 2100000000000000, 'wcashscan'
)
ON CONFLICT (profile_id) DO UPDATE SET
    chain = EXCLUDED.chain,
    ticker = EXCLUDED.ticker,
    genesis_hash = EXCLUDED.genesis_hash,
    post_genesis_branch_id = EXCLUDED.post_genesis_branch_id,
    target_spacing_seconds = EXCLUDED.target_spacing_seconds,
    halving_interval = EXCLUDED.halving_interval,
    monetary_ceiling_zatoshi = EXCLUDED.monetary_ceiling_zatoshi,
    source = EXCLUDED.source,
    updated_at = now();
