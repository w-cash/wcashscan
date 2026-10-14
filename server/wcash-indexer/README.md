# WcashExplorer Rust indexer

This binary is the ingestion service for WcashExplorer. It reads a W.cash Wolf
node, verifies the configured W.cash chain identity, parses canonical blocks and
transactions, and writes the PostgreSQL rows consumed by the Express API.
The browser never connects to this binary, Wolf, or PostgreSQL directly.

The web UI and API are adapted from the pinned `w-cash/wcashscan` source. The
indexer baseline and every consensus-sensitive W.cash change are recorded in
[`UPSTREAM.md`](UPSTREAM.md).

## Data path

```text
W.cash Wolf JSON-RPC
        ↓ identity check, block/tx reads
Rust Wcash indexer
        ↓ atomic canonical writes and reorg-safe checkpoint
PostgreSQL
        ↓ queries, cache and WebSocket publication
WcashExplorer API → Testnet UI and Mainnet-preview UI
```

JSON-RPC is the portable default and is the required source mode for a clean
W.cash regtest. Direct Wolf state access is an optional acceleration path only
when the operator has the matching state directory.

## Requirements

- Rust 1.97.1 (the version in `rust-toolchain.toml`)
- A W.cash Wolf node built from the pinned revision
- PostgreSQL 14 or newer
- A private RPC cookie or explicitly configured RPC credentials

The repository does not contain a Wolf binary or credentials. The supported
local service bundle, including migrations and startup ordering, is documented
in [`../../compose.wcash.yml`](../../compose.wcash.yml) and
[`../../docs/wcashscan-deployment.md`](../../docs/wcashscan-deployment.md).

## Build

```bash
cd server/wcash-indexer
cargo build --release
```

The binary is `target/release/wcashscan-indexer`.

## Configuration

The minimum RPC-backed configuration is:

```dotenv
WCASH_SOURCE=rpc
WCASH_CHAIN=wcash-testnet-v5
WCASH_RPC_URL=http://127.0.0.1:38232
WCASH_RPC_COOKIE_FILE=/var/lib/wcash/wolf-rpc/.cookie
WCASH_DATABASE_URL=postgres://wcashscan:<password>@127.0.0.1/wcashscan_testnet_v5
```

For W.cash regtest, change the profile and RPC port together:

```dotenv
WCASH_SOURCE=rpc
WCASH_CHAIN=wcash-regtest
WCASH_RPC_URL=http://127.0.0.1:48232
WCASH_RPC_COOKIE_FILE=/var/lib/wcash/wolf-rpc-regtest/.cookie
WCASH_DATABASE_URL=postgres://wcashscan:<password>@127.0.0.1/wcashscan_regtest
```

The configured profile supplies the expected genesis and post-genesis
consensus branch. The indexer fails closed before committing data if the node
does not match. Do not put cookie contents, passwords, wallet seeds, viewing
keys, or service tokens in Git or command history.

Optional settings include:

```dotenv
# Instant notifications; empty means bounded RPC polling.
WCASH_INDEXER_GRPC_URL=
MAX_REORG_DEPTH=100
BLOCK_SPOOL_PATH=/var/lib/wcash-indexer/block-spool
ENABLE_FULL_BLOCK_GRPC=0
RUST_LOG=wcashscan_indexer=info
```

## Commands

Run the read-only RPC identity check before any writer:

```bash
node scripts/wcash-rpc-preflight.mjs --profile wcash-testnet-v5 \
  --rpc-url http://127.0.0.1:38232
```

The same command for regtest is:

```bash
node scripts/wcash-rpc-preflight.mjs --profile wcash-regtest \
  --rpc-url http://127.0.0.1:48232
```

Then use the explicit RPC writer commands:

```bash
# Capture a canonical tip and index from height zero through that tip.
./target/release/wcashscan-indexer backfill-rpc --from 0 --to tip

# Follow the chain after the bounded backfill has finished.
./target/release/wcashscan-indexer live-rpc

# Machine-readable operational checks.
./target/release/wcashscan-indexer status --json
./target/release/wcashscan-indexer health --json
```

Backfill and live mode must not run concurrently against the same database.
The live writer verifies the previous canonical hash, records orphan evidence,
rolls back the affected range inside a transaction, and then commits the new
canonical branch.

## Database

Apply the base schema and ordered migrations with the deployment runner:

```bash
bash deploy/apply-migrations.sh
```

The main API tables are:

| Table | Purpose |
| --- | --- |
| `blocks` | Canonical and orphaned block headers and serialized sizes |
| `transactions` | Parsed W.cash transactions, fees, values and component counts |
| `transaction_inputs` | Transparent input references and resolved values |
| `transaction_outputs` | Transparent outputs, scripts and addresses |
| `shielded_flows` | Observed transparent ↔ Ironwood flow accounting |
| `indexer_state` | Resumable checkpoint and source freshness |
| `wcash_chain_identity` | Profile, genesis, branch and accounting invariants |
| `wcash_canonical_metrics` | Canonical aggregate metrics used by dashboards |

The API reads PostgreSQL. Redis is optional cache/pubsub infrastructure; it is
never treated as a second chain database.

## Source and implementation notes

- `src/config.rs` selects `wcash-testnet-v5` or `wcash-regtest` and enforces
  the matching identity.
- `src/db/rpc.rs` is the authenticated, bounded Wolf JSON-RPC client.
- `src/indexer/` owns ordered ingestion, transaction parsing and reorg safety.
- `src/db/postgres.rs` owns atomic PostgreSQL writes and checkpoints.
- `schema/migrations/` contains the API/indexer contract migrations.
- `deploy/` contains migration and operational helpers; the supported W.cash
  container entrypoint is `live-rpc`.

Some Rust module and type names retain `zebra_*` terminology because the
vendored wire/serialization primitives originated in the pinned upstream
indexer. Those names are not runtime endpoints and do not authorize a foreign
node or data source. Runtime source selection is limited to W.cash Wolf RPC or
the explicitly configured matching Wolf state.

## Verification

From the repository root:

```bash
node node_modules/typescript/bin/tsc --noEmit
NODE_PATH="$PWD/server/api/node_modules" node --test \
  server/tests/wcash-profile.test.js \
  server/tests/wcash-rpc-preflight.test.mjs
bash server/wcash-indexer/deploy/apply-migrations.sh --lint-only
```

The full live gate is the sequence in
[`../../docs/wcashscan-deployment.md`](../../docs/wcashscan-deployment.md).
It requires an operator-supplied pinned Wolf image, PostgreSQL, Redis and a
real local chain; fixture tests alone are not a live regtest result.

## License

MIT — see the repository license and the retained upstream license files in
this directory.
