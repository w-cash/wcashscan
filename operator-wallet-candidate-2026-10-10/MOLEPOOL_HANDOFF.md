# Molepool handoff: second Wcash coinbase receiver

This handoff changes the operator wallet only. It does not authorize a pool, Stratum, node, payout-worker, miner, or Mainnet transaction change.

## Preconditions

1. Verify the candidate checksum and source commit from `VALIDATION_REPORT.md`.
2. Stop every process that can write the wallet database. Do not copy a live SQLite database.
3. Confirm the seed/recovery material is backed up, readable, and controlled by the wallet operator. Never put it in a command argument, environment variable, pool host, log, ticket, or chat.
4. Record the current binary path, checksum, service definition, exact `--network mainnet`, and absolute wallet database path for rollback.
5. Keep the current index-0 route unchanged.

Set local shell variables deliberately:

```sh
WALLET_BIN=/absolute/path/to/verified/wcash-wallet
WALLET_DB=/absolute/private/wcash-wallet.sqlite
PUBLIC_ENDPOINT=https://mainnet.zecwec.com
```

The address-management commands below do not need the endpoint and never read the seed.

## List the current receivers

```sh
"$WALLET_BIN" \
  --network mainnet \
  --db "$WALLET_DB" \
  coinbase-address list | tee coinbase-addresses.before.json
```

Before continuing, confirm index 0 is the address already used by the existing route.

## Ensure index 1

```sh
"$WALLET_BIN" \
  --network mainnet \
  --db "$WALLET_DB" \
  coinbase-address ensure --index 1 | tee coinbase-address.index-1.json

"$WALLET_BIN" \
  --network mainnet \
  --db "$WALLET_DB" \
  coinbase-address ensure --index 1 | tee coinbase-address.index-1.repeated.json

cmp coinbase-address.index-1.json coinbase-address.index-1.repeated.json
```

`cmp` must exit successfully. Both calls must show child index `1`, `is_default: false`, and the same `W1...` address.

## Verify indices 0 and 1

```sh
"$WALLET_BIN" \
  --network mainnet \
  --db "$WALLET_DB" \
  coinbase-address list > coinbase-addresses.after.json

python3 - coinbase-addresses.after.json <<'PY'
import json, sys

with open(sys.argv[1], encoding="utf-8") as f:
    rows = json.load(f)

assert [row["child_index"] for row in rows] == [0, 1], rows
assert rows[0]["is_default"] is True, rows
assert rows[1]["is_default"] is False, rows
assert rows[0]["account_id"] == rows[1]["account_id"], rows
assert rows[0]["address"] != rows[1]["address"], rows
assert rows[0]["address"].startswith("W1"), rows
assert rows[1]["address"].startswith("W1"), rows
print("index_0=" + rows[0]["address"])
print("index_1=" + rows[1]["address"])
print("account_id=" + rows[0]["account_id"])
PY
```

Retain the JSON files in the private deployment record. They contain public metadata, not recovery material.

## Assign the second route

Use only the `index_1=` value printed above as the second route's coinbase destination. Apply it through Molepool's existing reviewed route configuration and change-control procedure.

- Leave the current route and its index-0 address unchanged.
- Change no listener, Stratum port, miner URL, payout protocol, payout worker, or node setting as part of this wallet handoff.
- Before publishing work, ask the target node for one disposable AuxPoW candidate for index 0 and one for index 1 at the same tip. Verify both extend the same previous block, the candidate hashes differ, then retire both unused candidates.
- After index 1 receives its first output, synchronize the same wallet and confirm the output is classified under child index 1. Wait for the exact 100-block coinbase maturity before shielding.

Read-only synchronization uses the reviewed public TLS endpoint:

```sh
"$WALLET_BIN" \
  --network mainnet \
  --db "$WALLET_DB" \
  --lightwalletd "$PUBLIC_ENDPOINT" \
  sync
```

This command writes synchronized wallet state. Run it only while the normal writer remains stopped or as the normal single writer.

## Rollback

1. Stop new jobs on the second route.
2. Point only that route back to the recorded index-0 address using the existing Molepool procedure.
3. Restore the previously checksummed wallet binary if the executable itself must be rolled back.
4. Do not delete or replace the wallet database and do not remove index 1 from the operator inventory.
5. Keep scanning both deterministic receivers. Index 1 remains wallet-owned after rollback, and late or immature coinbase outputs can still arrive.
6. Shield all mature outputs from both addresses into the same Ironwood receiver before retiring operational references to the second route.

No seed is needed to list or ensure these public receivers. Signing and shielding commands do require spending authority and are outside this two-command handoff.
