# WcashExplorer scanner status

## Scope decision

This project uses the UI and application logic from [w-cash/wcashscan](https://github.com/w-cash/wcashscan). The old `wcashexplorer.com` implementation is not part of this project and must not be reintroduced.

The imported scanner now lives at the workspace root beside the original static Wcash Wallet demo in `dist/`. The product name is **WcashExplorer**. The scanner source remains traceable to the requested upstream repository rather than to the old explorer.

## What the scanner repository contains

`wcashscan` is more than a frontend:

- Next.js/React/TypeScript explorer UI, dashboards, charts, tools, search, and route-level metadata.
- An Express API and WebSocket server under `server/api/`.
- PostgreSQL and Redis integration, gRPC/lightwalletd scan support, compact-block caching, and scanner tests.
- WASM/browser decoding and background workers.

It is not the entire data plane. The upstream deployment documentation expects PostgreSQL, Redis, a Zebra/Zakura-compatible node, and a separate Rust indexer (`cipherscan-rust`). A Wcash deployment must replace those Zcash-specific services with Wcash-compatible components. The Wcash organization currently exposes the relevant node and indexer work in [wolf](https://github.com/w-cash/wolf) and [wallet-indexer](https://github.com/w-cash/wallet-indexer).

## Local verification completed

The following checks passed after the import and WcashExplorer configuration:

- Production Next build: passed with all 75 generated routes.
- TypeScript: passed.
- ESLint: passed with 0 errors and 258 pre-existing warnings from the upstream source.
- Design-token check: passed.
- Scanner pipeline/cache/stream tests: 6 passed, 0 failed.
- Browser smoke test on `http://localhost:3000`: home data hydrated, theme switching worked, the stats-bar customization menu opened, and the Network dashboard rendered live block, supply, node-map, chart, and mining sections.
- Read-only route smoke coverage included blocks, transactions, network, charts, mempool, pools, privacy, privacy-risk, mining, rich list, reorgs, tools, docs, and the other shipped dashboard routes; each returned HTTP 200 in the local Next server.
- Wcash local-regtest RPC check: passed against the running Wcash node, including Wcash version identity, local-profile genesis, chain tip, block retrieval, and mempool response. Run it again with `npm run verify:regtest`.
- Wcash local-regtest scanner check: passed through `wcashscan`'s `/api/lightwalletd/scan` route against the node's embedded lightwalletd-compatible listener on `127.0.0.1:48234`; the live three-block tip range passed both JSON and `inbox-stream-v1` responses. Run it again with `npm run verify:regtest:scanner`.

The live data used for that UI smoke test was the upstream Zcash testnet API as a compatibility fixture only. It is not evidence that Wcash testnet data is indexed. The UI correctly exposed the fixture's remaining Zcash-specific payload labels, which is the next adaptation boundary.

### Local Wcash regtest boundary

The local Wcash `wolf` node is reachable at `127.0.0.1:48232`. Its RPC identifies `/Wcash:6.3.0/`, reports the Wcash local-profile genesis, and currently exposes a 572-block chain under the node's `test` network label. The `test` label is expected for this Wcash regtest profile; the verification accepts both `test` and `regtest` so it remains useful across Wcash profile revisions.

The compact-block scanner route is now regtest-tested, but the full explorer data plane is not. At the time of verification there was no persistent explorer API, PostgreSQL, Redis, or Wcash indexer attached to the node. The node's embedded lightwalletd-compatible listener is available and is covered by the scanner check above. Consequently, the browser dashboard pass remains explicitly fixture-backed; the next milestone is to connect a Wcash-compatible indexer/API to this same node and repeat the dashboard pass using only local Wcash data.

## Network configuration

The scanner now uses environment variables instead of hard-coded explorer hosts:

```text
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_TESTNET_API_URL=http://localhost:3001
NEXT_PUBLIC_MAINNET_API_URL=
```

When `NEXT_PUBLIC_MAINNET_API_URL` is empty, the mainnet mode intentionally reads from the configured testnet API and shows a visible **MAINNET PREVIEW** notice. When mainnet is live, set that one URL; the mainnet UI path remains intact. Site switcher URLs are also configurable with `NEXT_PUBLIC_MAINNET_URL`, `NEXT_PUBLIC_TESTNET_URL`, and `NEXT_PUBLIC_CROSSLINK_URL`.

This fallback is a deployment safety feature, not a claim that testnet data is mainnet data. Do not remove the notice or expose the preview as production mainnet until the Wcash mainnet API has been verified.

## What is still missing for a real Wcash testnet scanner

The upstream fork currently contains Zcash/TAZ/Orchard assumptions and no Wcash-specific implementation. The scanner endpoint in `server/api/routes/scan.js` is Orchard/compact-block oriented. Wcash compatibility needs a versioned data adapter and fixtures produced by the Wcash node, not a ticker rename.

Before calling the Wcash testnet scanner complete, wire and verify:

1. Wcash `wolf` node/CLI consensus and network parameters.
2. Wcash-compatible `wallet-indexer`/Zaino service or an equivalent compact-block/API source.
3. PostgreSQL schema and migrations for Wcash blocks, transactions, addresses, mempool, shielded data, and network statistics.
4. Express API contracts for blocks, transactions, addresses, mempool, dashboards, WebSocket updates, and scanner ranges.
5. Wcash address decoding, transaction/compact-block decoding, shielded-pool rules, coinbase maturity, reorg handling, and test vectors.
6. Contract tests against local Wcash regtest/testnet fixtures, followed by browser tests with no Zcash compatibility endpoint configured.

The Wcash network status must be checked before each deployment decision. The official [w.cash](https://w.cash/) site currently describes mainnet as not live, and the current Wcash node documentation still describes public-network readiness as an engineering/release milestone rather than a production guarantee.

## Recommended next step

The best next implementation step is a **Wcash data-adapter milestone**: stand up the Wcash node plus indexer locally, capture real block/transaction fixtures, and make the existing `wcashscan` API serve those fixtures through the same dashboard contracts. Then run the dashboard smoke suite against only the local Wcash API. That keeps the requested UI/logic intact while making the data boundary measurable and lets the later mainnet rollout be an environment URL change.

No private keys, wallet seeds, RPC cookies, API tokens, passwords, or other credentials belong in this file or in the repository.
