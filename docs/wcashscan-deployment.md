# WcashScan deployment runbook

The deployment is serverful and consists of Wolf, the packaged Rust indexer,
PostgreSQL, Redis, the API and two separately built Next.js web origins.

## Local contract

Copy `.env.wcash.local.example` to `.env.wcash.local`, fill secrets privately,
then run the commands documented in `compose.wcash.yml` once that stack is
configured. The public local ports are:

| Service | Address |
| --- | --- |
| Testnet web | `http://localhost:3000` |
| Mainnet preview web | `http://localhost:3002` |
| REST/WebSocket API | `http://localhost:3001` |

PostgreSQL and Redis must not be published outside the private Compose
network. Wolf RPC and both gRPC services must also remain private.

## Startup order

1. Validate Wolf identity and the expected Wcash genesis with
   `scripts/wcash-rpc-preflight.mjs`.
2. Start PostgreSQL and Redis, apply the packaged base schema and migrations.
3. Run a bounded RPC backfill from height zero to a captured canonical tip.
4. Start the live indexer and API. Do not run backfill and live writers at the
   same time.
5. Run Wcash jobs from their explicit allowlist, then start both web origins.
6. Check `/api/config`, `/health/deep`, REST routes, WebSocket updates and both
   browser origins.

## Local W.cash regtest

The same Compose stack can run against a W.cash Wolf regtest node, but it must
be given an actual Wolf image built from the pinned revision. Copy the example
environment file and set these values together before starting the stack:

```dotenv
WCASH_CHAIN=wcash-regtest
WCASH_EXPECTED_GENESIS=70bf0bab17eff361a6331bb825b3b7253c8c96ff96407f948161d2912658bb1c
WCASH_WOLF_NETWORK=regtest
WCASH_WOLF_RPC_BIND_PORT=48232
WCASH_RPC_URL=http://wolf:48232
WCASH_RPC_PORT=48232
WCASH_DB_NAME=wcashscan_regtest
WCASH_WOLF_IMAGE=<image-built-from-pinned-wolf>
```

Then run the read-only identity check and indexer/API smoke test:

```bash
node scripts/wcash-rpc-preflight.mjs --profile wcash-regtest --rpc-url http://127.0.0.1:48232
docker compose --env-file .env.wcash.local -f compose.wcash.yml up -d postgres redis
docker compose --env-file .env.wcash.local -f compose.wcash.yml run --rm migrate
docker compose --env-file .env.wcash.local -f compose.wcash.yml run --rm indexer
docker compose --env-file .env.wcash.local -f compose.wcash.yml up -d api web-testnet web-mainnet-preview
WCASH_CHAIN=wcash-regtest WCASH_E2E_REQUIRE_LIVE=true node scripts/verify-wcash-local.mjs
```

The preflight must report the exact regtest genesis and `c3a6678a` branch. A
fixture-only frontend build or an API process without Wolf/PostgreSQL is not a
regtest E2E result.

## Security

Use cookie-file or secret-mounted RPC authentication. Never put cookies,
wallet seeds, viewing keys, passwords or service tokens into Git, logs,
process arguments or the public API. CORS and WebSocket Origin allowlists must
contain only the two configured web origins and explicitly approved operators.

## Mainnet transition

The current Mainnet selector is a clearly labelled Testnet preview. A real
mainnet launch requires a separate Wolf node, database, indexer, jobs, cache
namespace, API origin and verified profile. It is not enabled by changing only
the ticker or selector label.
