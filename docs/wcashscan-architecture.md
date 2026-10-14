# WcashScan architecture

WcashScan is a serverful explorer. The browser is only the presentation layer;
chain data is produced by a W.cash node and an indexer owned by this
deployment.

```text
Wolf W.cash node
  ├─ JSON-RPC (private, authenticated)
  ├─ optional Indexer gRPC
  └─ optional CompactTxStreamer gRPC
          ↓
Wcash-adapted indexer (server/wcash-indexer)
          ↓
PostgreSQL canonical blocks, transactions, accounting and aggregates
          ↕
Redis cache/pubsub       Express API + WebSocket (localhost:3001)
          ↓
Next.js web-testnet (localhost:3000)
Next.js web-mainnet-preview (localhost:3002)
```

Both web origins currently select the same `wcash-testnet-v5` data profile.
The Mainnet origin is a UI preview only and must display that fact. It is not a
second chain and must never be presented as live W.cash mainnet.

## Authority and boundaries

- Wolf is authoritative for chain identity, canonical tip, raw blocks, node
  mempool, consensus branch and Wcash address/transaction decoding.
- The packaged Rust indexer is authoritative for persisted canonical rows,
  exact serialized sizes, transaction accounting, reorg recovery and source
  coverage.
- PostgreSQL is the API query source. Redis is a cache and WebSocket pub/sub
  transport, never a second chain database.
- The API exposes public chain facts and explicit `ready`, `empty`, `partial`,
  `syncing`, `stale` and `unavailable` states. It never exposes RPC cookies,
  private endpoints or inferred shielded recipients.
- The frontends use the API origin configured at build time. They do not fall
  back to CipherScan, Zcash, CoinGecko, NEAR or any other external data host.

## Selected UI versus actual data

`NEXT_PUBLIC_NETWORK` controls the selected web origin (`testnet` or
`mainnet`). `NEXT_PUBLIC_DATA_NETWORK` controls the actual chain profile. Until
an approved W.cash mainnet exists, both origins use `wcash-testnet-v5`, TWC,
the Testnet genesis and Testnet indexation policy.

## Reorg and writer ownership

There is one indexer writer and one jobs writer per database. Backfill and live
mode are never run concurrently. Each canonical write, accounting update,
aggregate publication and checkpoint advances atomically or is replayable by
the explicit recovery protocol. Orphan evidence is retained separately.
