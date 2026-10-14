# WcashScan indexer provenance

This directory is the W.cash adaptation of the upstream `cipherscan-rust`
indexer. It is intentionally vendored into the WcashScan repository so the
web/API build has a reviewable source boundary and does not fetch a different
indexer at deploy time.

## Frozen inputs

| Input | Revision | Purpose |
| --- | --- | --- |
| `w-cash/wcashscan` | `1093da71531bd71f83be95cfd76eb1af54d281d3` | UI, API, database contract |
| `w-cash/wolf` | `e83d1da5f288bdf25d99afab321a2faa37099e5f` | W.cash consensus and RPC node |
| `Kenbak/cipherscan-rust` | `56634c9102230826f675e731700290fce8efa1ed` | Indexer baseline |

The indexer baseline and its patched `zcash_*` crates retain their upstream
MIT/Apache license files. W.cash-specific changes are marked with
`WCASH-PATCHES.md` files or comments at the consensus boundary; they cover
chain identity, branch IDs, Wcash address namespaces, Ironwood-only value
pool accounting, and Wolf RPC/JSON shapes.

## Source boundary

`WCASH_SOURCE=rpc` is the default and is the required path for a clean local
regtest or a deployment where Wolf's RocksDB layout is not part of the
container. `WCASH_SOURCE=rocksdb` is an opt-in acceleration path for an
operator that has the matching Wolf state directory. Both paths must verify
the configured W.cash genesis before committing blocks to PostgreSQL.

The browser never reads Wolf RPC, RocksDB, or PostgreSQL. It reads the API
and WebSocket exposed by the sibling services in `compose.wcash.yml`.

