# Wcash operator wallet validation report

Date: 2026-10-10  
Repository: `w-cash/wolf`  
Source commit: `41a39cab3f259509653c1d4930df3dae3dabba98`  
PR state: Wolf #32 and #33 are present in `origin/main`; #33 is the source commit above.

## Decision

The multiple-coinbase-address implementation passed source review, wallet unit and integration tests, strict linting, the locked release build, and the repository's native real-node Regtest acceptance test. No wallet code defect was found, so another code PR is not required.

The Linux x86_64 candidate artifact is pending the separate Linux build step. Wolf deliberately has no enabled Wcash public-release pipeline, so this report does not claim an official, signed, tagged, or published release.

The repository's GitHub Actions page currently reports that Actions is disabled for `w-cash/wolf`. A qualifying run cannot be dispatched until the repository owner or GitHub Support restores Actions.

## Scope and safety

- Validation used a clean detached worktree at the exact `origin/main` commit.
- All chain operations used disposable Regtest data and repository-owned public test seeds.
- No production seed, private key, viewing key, wallet database, node, pool, Stratum listener, payout worker, miner route, or Mainnet transaction was used or changed.
- The retained evidence was sanitized. It contains no seed, key, viewing key, RPC cookie, wallet database, or raw signed transaction.

## Source review

- Index 0 remains the historical default derivation. The implementation has a direct byte-for-byte compatibility test.
- Index 1 is derived from the same ZIP 32 account and seed, produces a different network-correct transparent receiver, and is deterministic.
- Supported indices are restricted to `0..=9`; index 10 is rejected before wallet access.
- `ensure --index 1` is idempotent.
- `list` returns only the default and explicitly exposed receivers in child-index order.
- Managed receivers contribute to the same account balance and history.
- Shielding binds each selected transparent input to the matching child-index signing authority and sends the combined value to the same verified Ironwood receiver.
- Seed-only recovery scans the complete managed range and rediscovers both pre-birthday and spent creators.
- The merged change touches wallet code, wallet RPC client code, documentation, tests, and the local E2E script. It does not change consensus, AuxPoW rules, pool protocols, payout protocols, Stratum, or node deployment configuration.

## Commands and results

| Command | Result |
| --- | --- |
| `cargo fmt --all -- --check` | Passed |
| `cargo test -p wcash-wallet` | Passed: 140 tests (127 library, 11 CLI, 2 transaction-domain), 0 failures |
| `cargo clippy -p wcash-wallet --all-targets --all-features -- -D warnings` | Passed |
| `cargo build --locked --release -p wcash-wallet --bin wcash-wallet` | Passed on the local macOS arm64 host |
| `scripts/build-wcash-testnet-binaries.sh` | Passed; built isolated default-Zcash and Wcash-consensus nodes plus the coordinator and wallet |
| Native `scripts/wcash-testnet-e2e.sh` logic | Passed through Wcash Regtest height 102 |

The E2E run proved:

- indices 0 and 1 are distinct and share one account;
- same-tip `createauxblock` candidates work for both addresses and have distinct candidate hashes;
- index 0 is immature at tip 99 and becomes spendable at the exact 100-block boundary;
- indices 0 and 1 are both mature at tip 101;
- one transaction shields both 6.25-WEC inputs into Ironwood with a 20,000-zat fee;
- the shielding transaction is accepted, mined at height 102, and removed from the mempool;
- a late-birthday restore and a fresh seed-only restore rediscover both receivers, their combined transparent history, and the confirmed Ironwood output;
- Sprout, Sapling, and legacy Orchard balances remain zero.

The CLI was also run twice against the disposable wallet. Both `coinbase-address ensure --index 1` calls returned identical JSON. `coinbase-address list` returned ordered indices `[0, 1]`, one account ID, and two distinct Regtest addresses.

## Local build metadata

- Version output: `wcash-wallet 0.1.0`
- Rust: `rustc 1.91.0 (f8297e351 2025-10-28)`
- Local host target: `aarch64-apple-darwin`
- Local binary SHA-256: `d1fb7b74183c44dcc9f704f644ade9cb238c2999f1b55a85339619b0b45849df`
- The local Mach-O binary is validation evidence only and must not be installed on the Linux operator host.

## Evidence

- `evidence/regtest-public-evidence.json` contains the sanitized command results and chain facts.
- `evidence/local-input-checksums.sha256` binds the E2E script, lockfile, and local validation binary.
- `evidence/local-build-metadata.txt` records the local toolchain and binary metadata.

## Remaining release boundary

The repository's own release documentation says Wolf has no enabled Wcash public-release pipeline. The inherited Zebra release workflow does not build a Wcash wallet artifact. Therefore:

- this candidate must remain untagged and unpublished;
- its checksum proves byte identity but does not prove publisher identity;
- signing, SBOM, GitHub attestation, release upload, and Mainnet deployment require a separately reviewed Wcash-specific release process;
- the Wcash Release Gate cannot currently run because GitHub Actions is disabled for the repository;
- the Linux candidate may be handed directly to Konstantin only together with its exact source commit and checksum after the pending Linux build completes.
