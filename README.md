# WcashExplorer

WcashExplorer is the W.cash blockchain scanner built from the
[W.cash `wcashscan` UI and logic](https://github.com/w-cash/wcashscan). It is a
serverful explorer: the browser renders data from the local W.cash API and
never connects directly to Wolf, PostgreSQL, or a wallet.

The current public data profile is **W.cash Testnet** (`TWC`). The Mainnet
build is intentionally a labeled preview that reads the same Testnet API until
W.cash mainnet infrastructure is separately provisioned and verified.

## Data path

```text
W.cash Wolf node
    ↓ authenticated JSON-RPC / optional gRPC
Wcash-adapted Rust indexer
    ↓ canonical blocks, transactions, UTXOs and W.cash accounting
PostgreSQL
    ↓ queries and cache/pubsub
Express API + WebSocket
    ↓
Next.js Testnet UI + Mainnet-preview UI
```

The frontend is therefore only one layer of the scanner. The backend is
implemented in `server/api`, the ingestion binary is in `server/wcash-indexer`,
and the deployment contract is `compose.wcash.yml`.

## What is enabled

- blocks, transactions, transparent addresses and rich-list views;
- mempool and network status from Wolf;
- W.cash Ironwood activity and transparent/Ironwood accounting;
- mining attribution only when an operator supplies verified mappings;
- ordinary proof-of-work reorg detection and orphan evidence;
- explicit empty, partial, syncing, stale and unavailable states;
- Testnet and Mainnet-preview builds using the WcashExplorer branding.

Wallet scanning, arbitrary raw transaction decoding, broadcasting, pricing,
cross-chain/bridge views, governance, and unvalidated ownership inference are
closed or marked unavailable. No inherited Zcash/CipherScan value is used as a
W.cash fact.

## Local frontend preview

```bash
npm ci
npm run dev
```

This starts the Next.js UI on `http://localhost:3000`. It is useful for layout
and route checks, but dashboards show empty/unavailable states until the API
has indexed W.cash data.

Build each UI explicitly:

```bash
NEXT_PUBLIC_NETWORK=testnet WCASH_ALLOW_BUILD_UPSTREAM_FALLBACK=0 npm run build
NEXT_PUBLIC_NETWORK=mainnet WCASH_ALLOW_BUILD_UPSTREAM_FALLBACK=0 npm run build
```

## Full local stack

The supported serverful stack is in `compose.wcash.yml`:

| Service | Local address |
| --- | --- |
| Testnet UI | `http://localhost:3000` |
| Mainnet preview UI | `http://localhost:3002` |
| Express API/WebSocket | `http://localhost:3001` |
| Wolf RPC | `http://localhost:38232` (operator-only) |

PostgreSQL and Redis remain private to the Compose network. Wolf must be built
from the pinned W.cash revision in `server/wcash-indexer/UPSTREAM.md`, or an
operator must provide an image built from that revision. The Compose file
refuses to invent a node image.

Use the deployment runbook for startup order and secrets:

- [`docs/wcashscan-architecture.md`](docs/wcashscan-architecture.md)
- [`docs/wcashscan-deployment.md`](docs/wcashscan-deployment.md)
- [`docs/wcashscan-endpoints.md`](docs/wcashscan-endpoints.md)
- [`docs/wcashscan-implementation-status.md`](docs/wcashscan-implementation-status.md)

## Local W.cash regtest

The same stack supports W.cash regtest. Set these values together in a private
`.env.wcash.local`:

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

Validate identity before writes, then migrate, backfill and start the API:

```bash
node scripts/wcash-rpc-preflight.mjs --profile wcash-regtest --rpc-url http://127.0.0.1:48232
docker compose --env-file .env.wcash.local -f compose.wcash.yml up -d postgres redis
docker compose --env-file .env.wcash.local -f compose.wcash.yml run --rm migrate
docker compose --env-file .env.wcash.local -f compose.wcash.yml run --rm indexer
docker compose --env-file .env.wcash.local -f compose.wcash.yml up -d api web-testnet web-mainnet-preview
WCASH_CHAIN=wcash-regtest WCASH_E2E_REQUIRE_LIVE=true node scripts/verify-wcash-local.mjs
```

The required regtest identity is genesis
`70bf0bab17eff361a6331bb825b3b7253c8c96ff96407f948161d2912658bb1c` and
post-genesis branch `c3a6678a`. A successful frontend build without those
services is not a live regtest test.

## Verification

```bash
npm run verify                 # design-token and TypeScript checks
npm run test                   # W.cash profile and RPC-preflight tests
npm run test:wcash:e2e         # local web/API smoke; live mode is opt-in
git diff --check
```

`npm run verify:wcash` is a read-only Wolf identity check. It fails closed on a
genesis or consensus-branch mismatch. `WCASH_E2E_REQUIRE_LIVE=true` additionally
requires `/health/deep` to be healthy.

## Source and safety boundary

The W.cash source revisions and the adapted indexer boundary are documented in
[`server/wcash-indexer/UPSTREAM.md`](server/wcash-indexer/UPSTREAM.md). W.cash
network constants live in [`config/wcash-networks.json`](config/wcash-networks.json).

Never commit private keys, viewing keys, RPC cookies, passwords, API tokens,
service keys, or other credentials. The environment examples contain
placeholders only.

## License

See [`LICENSE`](LICENSE) for the repository license and the applicable upstream
licenses in the vendored indexer sources.
