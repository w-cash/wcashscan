-- WcashScan source-of-truth identity. This is deliberately independent of
-- any historical cross-chain, pricing, or governance tables in the inherited
-- schema snapshot. API startup checks this row before serving indexed data.
CREATE TABLE IF NOT EXISTS wcash_chain_identity (
    profile_id text PRIMARY KEY,
    chain text NOT NULL,
    ticker text NOT NULL,
    genesis_hash text NOT NULL,
    post_genesis_branch_id text NOT NULL,
    target_spacing_seconds integer NOT NULL,
    halving_interval bigint NOT NULL,
    monetary_ceiling_zatoshi bigint NOT NULL,
    source text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wcash_chain_identity (
    profile_id, chain, ticker, genesis_hash, post_genesis_branch_id,
    target_spacing_seconds, halving_interval, monetary_ceiling_zatoshi, source
) VALUES (
    'wcash-testnet-v5', 'WcashTestnet', 'TWC',
    '0271b5b0a10b2838f43cccdec9ca2f72aa72a7c103830082bac8f82f47f0593a',
    'b3cfd27e', 75, 1680000, 2100000000000000, 'wcashscan'
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

