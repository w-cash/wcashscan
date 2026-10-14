# WcashScan endpoint contract

The API is the only public chain-data interface. Wolf JSON-RPC, database,
Redis and indexer gRPC remain private.

## Identity and health

- `GET /api/config` returns the public Wcash profile, actual data network,
  genesis, branch, ticker, capabilities and current status.
- `GET /health` is a process/dependency liveness check.
- `GET /health/deep` reports node tip, indexed tip, lag, last index time,
  source coverage and job freshness. It never returns credentials or private
  connection strings.

Every chart response keeps its established payload keys and may include:

```json
{
  "meta": {
    "chain": "wcash-testnet-v5",
    "ticker": "TWC",
    "sourceHeight": 123,
    "sourceHash": "<canonical block hash>",
    "generatedAt": "<UTC timestamp>",
    "coverageStart": "<UTC date or null>",
    "coverageEnd": "<UTC date or null>",
    "status": "ready",
    "reason": null
  }
}
```

`empty` means a complete indexed interval has zero activity. `unavailable`,
`syncing`, `partial` and `stale` are not successful zeroes.

## Required explorer reads

The retained explorer surface includes blocks, transactions, transparent
addresses, rich list, mempool, Wcash supply, Ironwood accounting, reorgs,
network metrics and mining observations. The exact route list is recorded in
the implementation plan and must be exercised against Wcash fixtures and a
real indexed database before release.

The scanner routes are:

- `POST /api/scan/orchard` — legacy route name retained only where its response
  is useful; Wcash value is Ironwood and the route must not label it Orchard.
- `POST /api/lightwalletd/scan` — compact blocks fetched from the configured
  Wcash CompactTxStreamer, with a bounded range and optional cache.

The scanner is not a substitute for the canonical indexer. Wallet scanning is
an optional capability and remains disabled until Wcash-compatible decoders
are separately validated.

## No external data authority

No route may query `cipherscan.app`, `testnet.cipherscan.app`,
`api.*.cipherscan.app`, a stock Zcash RPC, CoinGecko, NEAR, wrapped-ZEC or
Crosslink services at runtime. Documentation links may reference upstream
source for provenance, but runtime requests must remain W.cash-only.
