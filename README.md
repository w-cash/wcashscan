# Wcash Wallet + WcashExplorer

A local website concept for the **Zingo-based Wcash wallet**, plus **WcashExplorer**, the scanner UI and application logic imported from [w-cash/wcashscan](https://github.com/w-cash/wcashscan). The old `wcashexplorer.com` implementation is not used.

## WcashExplorer scanner

The scanner is a full Next.js application with an Express/WebSocket API, PostgreSQL/Redis integrations, compact-block/lightwalletd scan support, WASM decoding, dashboards, charts, tools, and tests. It is not the complete Wcash data plane: a Wcash-compatible node and indexer/service are still required. See [`WCASHEXPLORER-STATUS.md`](WCASHEXPLORER-STATUS.md) for the architecture boundary, test evidence, and next milestone.

Run the scanner UI locally with Node 22.14+:

```sh
npm ci
NEXT_PUBLIC_NETWORK=testnet \
NEXT_PUBLIC_TESTNET_API_URL=http://localhost:3001 \
npm run dev
```

Open [http://localhost:3000/](http://localhost:3000/). Run the API separately from `server/api/` when its PostgreSQL, Redis, node, and indexer dependencies are available. Until a Wcash mainnet API exists, omitting `NEXT_PUBLIC_MAINNET_API_URL` intentionally makes mainnet mode reference the configured testnet API and shows a visible preview notice; replace that URL when mainnet is live.

Useful scanner checks:

```sh
npm run lint
npx tsc --noEmit
npm run build
node --test server/api/test/scan-pipeline.test.js server/api/test/scan-cache.test.js server/api/test/scan-stream.test.js

# Read-only check against the local Wcash wolf regtest RPC (default: 48232)
npm run verify:regtest

# Exercise wcashscan's compact-block scanner route against Wcash's
# lightwalletd-compatible regtest listener (default: 48234)
npm run verify:regtest:scanner
```

The existing local UI audit used a Zcash testnet endpoint only as a read-only compatibility fixture. It did not claim Wcash testnet data. Wcash readiness requires the adapter work described in [`WCASHEXPLORER-STATUS.md`](WCASHEXPLORER-STATUS.md).

## Run locally

Serve the `dist` directory with any static HTTP server. For example:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173. No package installation or build step is required.

## Included

- Responsive single-page wallet website and locally hosted fonts.
- An immersive cobalt-and-ivory wallet demo with original currency engraving.
- A private/public view slider and subtle pointer-responsive banknote motion.
- Send, review, simulate, receive, activity and reset flows, using sample funds only.
- Zingo-informed total/spendable balance labels, address-derived privacy, optional shielded memos, and shielded receiving details.
- Device-aware download selection for all five platforms, accessible tabs and keyboard navigation.
- Native FAQ disclosures, mobile navigation, reduced-motion support and custom favicon.
- Large typographic network section and merged-mining diagram.
- Optional WebMCP tools for the same demo state and actions.

## Release configuration

All five download destinations are explicitly placeholders at `https://wcashwallet.com`. Replace the URLs in `dist/app.js` with verified release links, then remove or update the preview note and device FAQ when actual releases are available. The wallet UI contains illustrative balances and activity, and is not connected to a blockchain.

The site has not been deployed or registered with a hosting provider. `.openai/hosting.json` identifies `dist` as the static output for possible future hosting.

The simulated transfer flow was verified through the browser's WebMCP context: staging 25 WCASH to Alex, completing it, checking a 2,455 WCASH sample balance and new activity, rejecting an excessive amount and duplicate completion, and resetting to the original state. All actions run in memory; refreshing also resets the demo. No blockchain services, private keys, recovery phrases, real addresses, market data, or real funds are involved.

See `DESIGN-RESEARCH.md` for the reference review and content decisions.

For a complete handoff to another Codex context—including source locations, Zingo alignment, regtest procedures, and GitHub SSH/PR workflow—see [`CODEX-CONTEXT.md`](CODEX-CONTEXT.md).

The demo models all sample funds as spendable and shielded. Alex is a fictional shielded recipient; Morgan is a fictional transparent recipient. A transparent recipient cannot be made private using a toggle, and encrypted memos are offered only for shielded recipients. The 120-character memo limit is a demo constraint. This website does not embed Zingolib or verify a native Wcash wallet build.
