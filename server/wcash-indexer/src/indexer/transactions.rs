//! W.cash transaction parsing.
//!
//! The parser deliberately consumes Wolf's public `zebra-chain` accessors
//! instead of matching private transaction internals. That keeps the indexer
//! aligned with the pinned Wcash consensus implementation, including the v6
//! Ironwood pool and Wcash transaction-id domain.

use crate::config::Network;
use crate::models::{PubkeyExposure, Transaction, TransparentInput, TransparentOutput};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::io::Cursor;
use zebra_chain::serialization::ZcashDeserialize;
use zebra_chain::transaction::Transaction as ZebraTransaction;

/// Transaction parser using the pinned Wolf `zebra-chain` API.
pub struct TransactionParser;

impl TransactionParser {
    /// W.cash transparent Base58Check prefixes. These are intentionally not
    /// Zcash's `t1`/`t3` or testnet `tm`/`t2` prefixes.
    fn addr_prefixes(network: Network) -> ([u8; 2], [u8; 2]) {
        match network {
            Network::Mainnet => ([0x10, 0x55], [0x10, 0x5a]),
            Network::Testnet | Network::Regtest => ([0x10, 0x95], [0x10, 0x98]),
        }
    }

    /// Parse a raw transaction from W.cash wire bytes.
    pub fn parse(
        raw: &[u8],
        block_height: u32,
        block_hash: &str,
        network: Network,
    ) -> Result<Transaction, String> {
        let mut cursor = Cursor::new(raw);
        let zebra_tx = ZebraTransaction::zcash_deserialize(&mut cursor)
            .map_err(|e| format!("failed to deserialize W.cash transaction: {e:?}"))?;

        Self::from_zebra_tx(zebra_tx, block_height, block_hash, raw.len(), network)
    }

    /// Convert Wolf's consensus transaction into the database model.
    pub(crate) fn from_zebra_tx(
        tx: ZebraTransaction,
        block_height: u32,
        block_hash: &str,
        size: usize,
        network: Network,
    ) -> Result<Transaction, String> {
        let txid = tx.hash().to_string();
        let version = i32::try_from(tx.version())
            .map_err(|_| format!("transaction version is too large for {txid}"))?;
        let expiry_height = tx.expiry_height().map(|height| height.0);
        let is_coinbase = tx.is_coinbase();
        let inputs = tx.inputs();
        let outputs = tx.outputs();

        let mut vin = Vec::with_capacity(inputs.len());
        for input in inputs {
            use zebra_chain::transparent::Input;
            match input {
                Input::Coinbase { data, .. } => vin.push(TransparentInput {
                    txid: "0".repeat(64),
                    vout: u32::MAX,
                    address: None,
                    value: None,
                    is_coinbase: true,
                    script_sig: Some(hex::encode(data)),
                }),
                Input::PrevOut {
                    outpoint,
                    unlock_script,
                    ..
                } => vin.push(TransparentInput {
                    txid: outpoint.hash.to_string(),
                    vout: outpoint.index,
                    address: None,
                    value: None,
                    is_coinbase: false,
                    script_sig: Some(hex::encode(unlock_script.as_raw_bytes())),
                }),
            }
        }

        let mut vout = Vec::with_capacity(outputs.len());
        let mut transparent_value_out = 0i64;
        for (n, output) in outputs.iter().enumerate() {
            let value_zat = output.value().zatoshis();
            transparent_value_out = transparent_value_out
                .checked_add(value_zat)
                .ok_or_else(|| format!("transparent output overflow in {txid}"))?;
            let (address, script_type, pubkey_exposures) =
                Self::parse_output_script(&output.lock_script, network);

            vout.push(TransparentOutput {
                n: n as u32,
                value: value_zat,
                address,
                script_type,
                script_pub_key: Some(hex::encode(output.lock_script.as_raw_bytes())),
                pubkey_exposures,
            });
        }

        let ironwood_value_balance = tx.ironwood_value_balance().ironwood_amount().zatoshis();
        let ironwood_anchor = tx
            .ironwood_anchor()
            .map(|root| hex::encode(root.bytes_in_display_order()));

        Ok(Transaction {
            txid,
            block_height,
            block_hash: block_hash.to_string(),
            version,
            lock_time: tx.raw_lock_time(),
            expiry_height,
            size: size as u32,
            vin_count: vin.len() as u16,
            vout_count: vout.len() as u16,
            transparent_value_in: 0,
            transparent_value_out,
            // W.cash exposes Ironwood as its only shielded pool. These
            // compatibility columns are intentionally zeroed instead of
            // carrying inherited Zcash pool data into WcashScan.
            joinsplit_count: 0,
            sapling_spends: 0,
            sapling_outputs: 0,
            orchard_actions: 0,
            ironwood_actions: tx.ironwood_actions().count() as u16,
            sapling_value_balance: 0,
            orchard_value_balance: 0,
            ironwood_value_balance,
            orchard_anchor: None,
            ironwood_anchor,
            // Transparent inputs are resolved against the canonical UTXO
            // history after parsing. Coinbase fees are never inferred.
            fee: if is_coinbase { None } else { None },
            vin,
            vout,
        })
    }

    /// Parse a transparent output script and encode only W.cash addresses.
    fn parse_output_script(
        script: &zebra_chain::transparent::Script,
        network: Network,
    ) -> (Option<String>, String, Vec<PubkeyExposure>) {
        let bytes = script.as_raw_bytes();
        if bytes.is_empty() {
            return (None, "empty".to_string(), Vec::new());
        }

        let (p2pkh_prefix, p2sh_prefix) = Self::addr_prefixes(network);

        if bytes.len() == 25
            && bytes[0] == 0x76
            && bytes[1] == 0xa9
            && bytes[2] == 0x14
            && bytes[23] == 0x88
            && bytes[24] == 0xac
        {
            return (
                Some(Self::encode_address(&p2pkh_prefix, &bytes[3..23])),
                "pubkeyhash".to_string(),
                Vec::new(),
            );
        }

        if bytes.len() == 23 && bytes[0] == 0xa9 && bytes[1] == 0x14 && bytes[22] == 0x87 {
            return (
                Some(Self::encode_address(&p2sh_prefix, &bytes[2..22])),
                "scripthash".to_string(),
                Vec::new(),
            );
        }

        if bytes.len() == 35
            && bytes[0] == 0x21
            && matches!(bytes[1], 0x02 | 0x03)
            && bytes[34] == 0xac
        {
            return (
                None,
                "pubkey".to_string(),
                vec![Self::pubkey_exposure(0, &bytes[1..34], &p2pkh_prefix)],
            );
        }

        if bytes.len() == 67 && bytes[0] == 0x41 && bytes[1] == 0x04 && bytes[66] == 0xac {
            return (
                None,
                "pubkey".to_string(),
                vec![Self::pubkey_exposure(0, &bytes[1..66], &p2pkh_prefix)],
            );
        }

        if bytes.len() >= 37 && bytes[bytes.len() - 1] == 0xae {
            let m = bytes[0] as i32 - 0x50;
            let n = bytes[bytes.len() - 2] as i32 - 0x50;
            if (1..=16).contains(&m) && (1..=16).contains(&n) && m <= n {
                if let Some(pubkeys) =
                    Self::extract_multisig_pubkeys(&bytes[1..bytes.len() - 2], n as usize)
                {
                    let exposures = pubkeys
                        .into_iter()
                        .enumerate()
                        .map(|(index, key)| Self::pubkey_exposure(index as u16, key, &p2pkh_prefix))
                        .collect();
                    return (None, "multisig".to_string(), exposures);
                }
            }
        }

        if bytes[0] == 0x6a {
            return (None, "nulldata".to_string(), Vec::new());
        }

        (None, "nonstandard".to_string(), Vec::new())
    }

    fn hash160(data: &[u8]) -> [u8; 20] {
        use ripemd::Ripemd160;
        use sha2::{Digest, Sha256};

        let sha = Sha256::digest(data);
        let ripe = Ripemd160::digest(sha);
        let mut out = [0u8; 20];
        out.copy_from_slice(&ripe);
        out
    }

    fn pubkey_exposure(index: u16, pubkey: &[u8], prefix: &[u8]) -> PubkeyExposure {
        PubkeyExposure {
            pubkey_index: index,
            pubkey_hex: hex::encode(pubkey),
            derived_p2pkh: Self::encode_address(prefix, &Self::hash160(pubkey)),
        }
    }

    fn extract_multisig_pubkeys(script_body: &[u8], expected_n: usize) -> Option<Vec<&[u8]>> {
        let mut cursor = 0;
        let mut pubkeys = Vec::with_capacity(expected_n);
        while cursor < script_body.len() {
            let push_len = *script_body.get(cursor)? as usize;
            if push_len != 33 && push_len != 65 {
                return None;
            }
            let start = cursor.checked_add(1)?;
            let end = start.checked_add(push_len)?;
            let pubkey = script_body.get(start..end)?;
            let valid = (push_len == 33 && matches!(pubkey[0], 0x02 | 0x03))
                || (push_len == 65 && pubkey[0] == 0x04);
            if !valid {
                return None;
            }
            pubkeys.push(pubkey);
            cursor = end;
        }
        (pubkeys.len() == expected_n).then_some(pubkeys)
    }

    fn encode_address(prefix: &[u8], hash: &[u8]) -> String {
        use sha2::{Digest, Sha256};

        let mut data = Vec::with_capacity(prefix.len() + hash.len() + 4);
        data.extend_from_slice(prefix);
        data.extend_from_slice(hash);
        let first = Sha256::digest(&data);
        let second = Sha256::digest(first);
        data.extend_from_slice(&second[..4]);
        bs58::encode(data).into_string()
    }

    /// Resolve every transparent input using the canonical RocksDB UTXO
    /// lookup. Same-block outputs are inserted first and therefore always win.
    pub fn resolve_block_inputs(
        transactions: &mut [Transaction],
        zebra: &crate::db::ZebraState,
    ) -> Result<(), String> {
        let current_outputs: HashMap<(String, u32), (i64, Option<String>)> = transactions
            .iter()
            .flat_map(|tx| {
                tx.vout.iter().map(move |output| {
                    (
                        (tx.txid.clone(), output.n),
                        (output.value, output.address.clone()),
                    )
                })
            })
            .collect();

        let mut external_references: BTreeMap<String, BTreeSet<u32>> = BTreeMap::new();
        for tx in transactions.iter() {
            for input in tx.vin.iter().filter(|input| !input.is_coinbase) {
                if !current_outputs.contains_key(&(input.txid.clone(), input.vout)) {
                    external_references
                        .entry(input.txid.clone())
                        .or_default()
                        .insert(input.vout);
                }
            }
        }

        let mut resolved_outputs = current_outputs;
        for (txid, indexes) in external_references {
            let indexes = indexes.into_iter().collect::<Vec<_>>();
            let outputs = zebra
                .get_outputs_by_txid(&txid, &indexes)
                .map_err(|error| format!("failed to resolve outputs for {txid}: {error}"))?;
            resolved_outputs.extend(
                outputs
                    .into_iter()
                    .map(|(index, output)| ((txid.clone(), index), output)),
            );
        }

        for tx in transactions {
            if tx.is_coinbase() {
                tx.fee = None;
                continue;
            }

            for input in &mut tx.vin {
                let (value, address) = resolved_outputs
                    .get(&(input.txid.clone(), input.vout))
                    .cloned()
                    .ok_or_else(|| {
                        format!(
                            "unresolved prevout {}:{} for {}",
                            input.txid, input.vout, tx.txid
                        )
                    })?;
                input.value = Some(value);
                input.address = address;
            }

            tx.transparent_value_in = tx.vin.iter().try_fold(0i64, |total, input| {
                total
                    .checked_add(input.value.unwrap_or(0))
                    .ok_or_else(|| format!("transparent input overflow for {}", tx.txid))
            })?;

            let fee = tx
                .transparent_value_in
                .checked_add(tx.ironwood_value_balance)
                .and_then(|value| value.checked_sub(tx.transparent_value_out))
                .ok_or_else(|| format!("fee overflow for {}", tx.txid))?;
            tx.fee = (fee >= 0).then_some(fee);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wcash_testnet_p2pkh_prefix_is_disjoint_from_zcash() {
        let hash = [0u8; 20];
        let (p2pkh, p2sh) = TransactionParser::addr_prefixes(Network::Testnet);
        assert_eq!(p2pkh, [0x10, 0x95]);
        assert_eq!(p2sh, [0x10, 0x98]);
        let p2pkh_address = TransactionParser::encode_address(&p2pkh, &hash);
        let p2sh_address = TransactionParser::encode_address(&p2sh, &hash);
        assert_ne!(p2pkh_address, p2sh_address);
        assert!(!p2pkh_address.starts_with("tm"));
        assert!(!p2sh_address.starts_with("t2"));
    }

    #[test]
    fn regtest_uses_the_same_wcash_transparent_namespace() {
        assert_eq!(
            TransactionParser::addr_prefixes(Network::Regtest),
            ([0x10, 0x90], [0x10, 0x93])
        );
    }

    #[test]
    fn p2pk_exposes_derived_keys_without_claiming_ownership() {
        let mut script = vec![0x21, 0x02];
        script.extend_from_slice(&[0xaa; 32]);
        script.push(0xac);
        let parsed = TransactionParser::parse_output_script(
            &zebra_chain::transparent::Script::new(&script),
            Network::Testnet,
        );
        assert_eq!(parsed.1, "pubkey");
        assert_eq!(parsed.2.len(), 1);
        assert!(parsed.2[0].derived_p2pkh.len() > 20);
    }
}
