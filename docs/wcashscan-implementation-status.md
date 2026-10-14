# WcashExplorer implementation status

Updated: 2026-09-15

This document distinguishes source implementation, fixture tests, local live
tests, staging tests and blocked operator inputs. A successful HTTP response
from a mock endpoint is not release evidence.

## Baseline

- [x] Clean implementation branch based on `w-cash/wcashscan` upstream.
- [x] Pinned Wolf and `cipherscan-rust` revisions recorded in the plan.
- [x] Wcash data profile and public configuration contract added.
- [ ] Wcash-adapted indexer compiled and integrated with a disposable database.
- [ ] Local Compose stack indexed a real Wcash chain.
- [x] Both browser origins audited as production builds with the API offline;
  unavailable states remain renderable instead of becoming server errors.

## Operator inputs still required

- Authenticated, synchronized Wolf W.cash Testnet RPC with historical raw
  blocks and a container-reachable address.
- Wcash peer inventory when bootstrapping a new node.
- Private cookie mount/secret injection, database secrets and chosen public
  hosts/TLS configuration.

## Evidence policy

Record exact commands, source heights/hashes, coverage, timings and failures
here. Do not claim production deployment, live Testnet coverage or real
mainnet readiness without those inputs and the acceptance gates.

## Verification recorded on 2026-09-15

- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- `node --check` over all `server/` and `scripts/` JavaScript — passed.
- Relevant API/profile/config/regtest tests — 157 tests, 156 passed, 1 optional
  Redis integration skipped, 0 failed. This includes the genesis-only
  height-0 `/api/config` contract.
- API v1 contract suite — 74 tests passed, including feature-gated route
  registration and the Wcash scan adapters.
- `bash server/wcash-indexer/deploy/apply-migrations.sh --lint-only` — passed;
  26 migration files were inspected.
- `cargo metadata --format-version 1 --locked --no-deps` — passed after
  regenerating `Cargo.lock` against the pinned Wolf dependency graph.
- `cargo check --locked` reached dependency compilation but could not link on
  this macOS host because the Xcode/Apple SDK license is not accepted. This is
  an environment blocker, not compile evidence.
- Testnet and Mainnet-preview production builds — both passed with
  `WCASH_ALLOW_BUILD_UPSTREAM_FALLBACK=0`.
- Isolated local servers on ports 3000 and 3002 — 84 core/detail/static route
  checks passed, including the RSS origin contract; exact network banners,
  Mainnet-preview noindex policy and mining/pool control interactions passed;
  rendered HTML contained no retired CipherScan/cross-chain branding.
- `WCASH_E2E_SKIP_API=true node scripts/verify-wcash-local.mjs` passed the
  repeatable two-origin web matrix: 39 retained routes per origin, seven
  retired web routes per origin returning 404, and the Testnet-only sitemap
  policy. The API portion remains intentionally pending until the local
  PostgreSQL/Wolf stack is available.
- Regtest preflight contract tests — matching genesis and `c3a6678a` branch
  accepted; wrong genesis, foreign node identity and wrong branch rejected.

## Live-regtest boundary

No Wolf binary/image, Docker/Podman runtime, PostgreSQL server or Redis server
was available on this host, and ports 48232/5432/6379 were closed. Therefore a
real W.cash regtest node was not started and a live indexer → PostgreSQL → API
→ browser result must remain unchecked. The deterministic preflight tests use
an in-process JSON-RPC contract fixture; they do not claim chain coverage.

The next release gate is to provide the pinned Wolf image/config and run the
regtest sequence in `docs/wcashscan-deployment.md`: preflight, migrations,
genesis-to-tip RPC backfill, live polling, API deep health, WebSocket events,
and both browser origins against the resulting indexed data.
