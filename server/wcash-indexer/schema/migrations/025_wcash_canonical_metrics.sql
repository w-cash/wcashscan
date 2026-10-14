-- Migration 025: canonical W.cash block accounting and source identity.
--
-- This table is the indexed source of truth for cumulative issuance, pool
-- balances and serialized bytes. It is keyed by height and carries the
-- canonical hash so a same-height replacement cannot silently retain the old
-- cumulative row. The indexer writes it in the same PostgreSQL transaction as
-- the block, transaction and checkpoint data.

ALTER TABLE wcash_chain_identity
    ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS wcash_block_metrics (
    height                    BIGINT PRIMARY KEY,
    block_hash                TEXT NOT NULL,
    block_time                BIGINT NOT NULL,
    subsidy_zat               BIGINT NOT NULL,
    fees_zat                  BIGINT NOT NULL,
    cumulative_issuance_zat   BIGINT NOT NULL,
    transparent_balance_zat   BIGINT NOT NULL,
    ironwood_balance_zat      BIGINT NOT NULL,
    serialized_bytes          BIGINT NOT NULL,
    source                    TEXT NOT NULL DEFAULT 'wcash-indexer',
    created_at                TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wcash_block_metrics_hash
    ON wcash_block_metrics (block_hash);

ALTER TABLE chain_snapshots
    ADD COLUMN IF NOT EXISTS source_block_height BIGINT,
    ADD COLUMN IF NOT EXISTS source_block_hash TEXT;

ALTER TABLE privacy_stats
    ADD COLUMN IF NOT EXISTS source_block_height BIGINT,
    ADD COLUMN IF NOT EXISTS source_block_hash TEXT;

ALTER TABLE privacy_trends_daily
    ADD COLUMN IF NOT EXISTS source_block_height BIGINT,
    ADD COLUMN IF NOT EXISTS source_block_hash TEXT;

ALTER TABLE turnstile_daily
    ADD COLUMN IF NOT EXISTS source_block_height BIGINT,
    ADD COLUMN IF NOT EXISTS source_block_hash TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON wcash_block_metrics TO zcash_user;
