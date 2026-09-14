# WcashExplorer

WcashExplorer is the Wcash adaptation of the [wcashscan](https://github.com/w-cash/wcashscan) blockchain explorer. It keeps the upstream Next.js/React interface and scanner logic while making the network, currency, API and compact-block connection configurable for Wcash.

The old `wcashexplorer.com` implementation is not used.

## What is included

- Explorer pages for blocks, transactions, addresses, mempool, mining, pools, privacy and network activity.
- Client-side tools and WASM decoding inherited from wcashscan.
- Express/WebSocket API integration with PostgreSQL and Redis support.
- Compact-block/lightwalletd scanning with configurable endpoints.
- Explicit testnet and mainnet configuration. Mainnet falls back to testnet data until a Wcash mainnet API is available.
- Read-only local Wcash regtest and scanner verification scripts.

The repository contains the application and API integration. A production data plane still needs a Wcash-compatible node, lightwalletd/indexer service, PostgreSQL database and Redis instance.

## Run the explorer UI

Use Node.js 22.14.x (see `.node-version`):

```sh
npm ci
NEXT_PUBLIC_NETWORK=testnet \
NEXT_PUBLIC_TESTNET_API_URL=http://localhost:3001 \
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production build:

```sh
npm run build
npm start
```

## Network configuration

The browser-facing API origin is selected with environment variables:

```env
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_TESTNET_API_URL=http://localhost:3001
# Set this only when the Wcash mainnet API is live.
NEXT_PUBLIC_MAINNET_API_URL=https://replace-with-wcash-mainnet-api.example
```

When `NEXT_PUBLIC_MAINNET_API_URL` is unset, mainnet mode intentionally uses the configured testnet API and displays a preview notice. Bringing up mainnet later only requires replacing that URL and rebuilding.

Do not place RPC credentials, private keys, API tokens or other secrets in browser-exposed environment variables.

## Verification

```sh
# Fast source checks
npm run lint
npx tsc --noEmit

# Production build
npm run build

# Local route contract
npm run verify:local

# Read-only Wcash wolf regtest RPC check (default RPC port: 48232)
npm run verify:regtest

# Exercise the wcashscan compact-block scanner against Wcash lightwalletd
# (default gRPC port: 48234)
npm run verify:regtest:scanner
```

The local regtest checks expect Wcash `wolf`/Zebrad-compatible services at:

- RPC: `http://127.0.0.1:48232`
- lightwalletd-compatible gRPC: `127.0.0.1:48234`

Override them with `WCASH_REGTEST_RPC_URL` and `LIGHTWALLETD_ADDRESS` when needed.

## API service

The API service lives in [`server/api`](server/api). Start it only after configuring its database, Redis, Wcash node and indexer dependencies. The frontend must point to that service with `NEXT_PUBLIC_TESTNET_API_URL`; it should not connect to node RPC directly from the browser.

## Project status

See [`WCASHEXPLORER-STATUS.md`](WCASHEXPLORER-STATUS.md) for the current architecture boundary, tested local-regtest behavior and remaining Wcash indexer work. [`CODEX-CONTEXT.md`](CODEX-CONTEXT.md) contains the broader project handoff, source locations and operational notes.

## License

See [`LICENSE`](LICENSE).
