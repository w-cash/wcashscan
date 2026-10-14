//! W.cash shielded flow models.
//!
//! Flows represent value crossing between transparent outputs and the native
//! Ironwood pool. Legacy enum variants remain only for database compatibility.

use crate::models::Transaction;
use serde::{Deserialize, Serialize};

/// Type of shielded flow
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlowType {
    /// Transparent to shielded
    Shield,
    /// Shielded to transparent
    Deshield,
    /// Legacy compatibility value. WcashScan never emits this variant.
    PoolMigration,
    /// Legacy compatibility value. WcashScan never emits this variant.
    FullyShielded,
}

impl FlowType {
    pub fn as_str(&self) -> &'static str {
        match self {
            FlowType::Shield => "shield",
            FlowType::Deshield => "deshield",
            FlowType::PoolMigration => "pool_migration",
            FlowType::FullyShielded => "fully_shielded",
        }
    }
}

impl std::fmt::Display for FlowType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Shielded pool. W.cash records use `Ironwood`; the legacy variants remain
/// readable so the schema does not need a destructive rewrite.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Pool {
    Sprout,
    Sapling,
    Orchard,
    Ironwood,
}

impl Pool {
    pub fn as_str(&self) -> &'static str {
        match self {
            Pool::Sprout => "sprout",
            Pool::Sapling => "sapling",
            Pool::Orchard => "orchard",
            Pool::Ironwood => "ironwood",
        }
    }
}

impl std::fmt::Display for Pool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// A shielded flow record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShieldedFlow {
    pub txid: String,
    pub flow_type: String,
    pub pool: String,
    pub amount: i64, // In zatoshis (always positive)
    pub block_height: u32,
    pub transparent_addresses: Vec<String>,
}

impl ShieldedFlow {
    /// Analyze a transaction and extract W.cash-native public flows.
    ///
    /// Ironwood's value balance is negative when value enters the pool and
    /// positive when it leaves. A flow is emitted only when the transaction
    /// has transparent I/O. Fully shielded transactions have no public
    /// boundary that the scanner can attribute, so they produce no flow.
    /// Sapling, Orchard, and Sprout fields are deliberately ignored.
    pub fn from_transaction(tx: &Transaction) -> Vec<ShieldedFlow> {
        if tx.is_coinbase() {
            return Vec::new();
        }

        let value_balance = tx.ironwood_value_balance;
        if value_balance == 0 || (tx.vin_count == 0 && tx.vout_count == 0) {
            return Vec::new();
        }

        // Collect transparent addresses for context
        let addresses: Vec<String> = tx
            .vin
            .iter()
            .filter_map(|v| v.address.clone())
            .chain(tx.vout.iter().filter_map(|v| v.address.clone()))
            .collect();

        let flow_type = if value_balance > 0 {
            FlowType::Deshield
        } else {
            FlowType::Shield
        };

        // checked_abs guards the i64::MIN edge case (its magnitude does not fit
        // in i64), which plain `.abs()` would panic on.
        let amount = match value_balance.checked_abs() {
            Some(amount) => amount,
            None => {
                eprintln!(
                    "⚠️ Ironwood value-balance abs() overflow for tx {} — skipping flow classification",
                    tx.txid
                );
                return Vec::new();
            }
        };

        vec![ShieldedFlow {
            txid: tx.txid.clone(),
            flow_type: flow_type.to_string(),
            pool: Pool::Ironwood.to_string(),
            amount, // Always positive
            block_height: tx.block_height,
            transparent_addresses: addresses,
        }]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Transaction;

    #[test]
    fn test_flow_type_display() {
        assert_eq!(FlowType::Shield.as_str(), "shield");
        assert_eq!(FlowType::Deshield.as_str(), "deshield");
    }

    #[test]
    fn test_only_ironwood_transparent_boundaries_emit_flows() {
        let shield = Transaction {
            txid: "ironwood-shield".to_string(),
            block_height: 1,
            block_hash: "hash".to_string(),
            version: 6,
            lock_time: 0,
            expiry_height: None,
            size: 200,
            vin_count: 1,
            vout_count: 0,
            transparent_value_in: 2_000_000_000,
            transparent_value_out: 0,
            joinsplit_count: 0,
            sapling_spends: 0,
            sapling_outputs: 0,
            orchard_actions: 0,
            ironwood_actions: 1,
            sapling_value_balance: 0,
            orchard_value_balance: 0,
            ironwood_value_balance: -1_999_000_000,
            orchard_anchor: None,
            ironwood_anchor: None,
            fee: Some(1_000_000),
            vin: vec![],
            vout: vec![],
        };
        let shield_flows = ShieldedFlow::from_transaction(&shield);
        assert_eq!(shield_flows.len(), 1);
        assert_eq!(shield_flows[0].pool, "ironwood");
        assert_eq!(shield_flows[0].flow_type, "shield");
        assert_eq!(shield_flows[0].amount, 1_999_000_000);

        let deshield = Transaction {
            txid: "ironwood-deshield".to_string(),
            block_height: 2,
            block_hash: "hash".to_string(),
            version: 6,
            lock_time: 0,
            expiry_height: None,
            size: 200,
            vin_count: 0,
            vout_count: 1,
            transparent_value_in: 0,
            transparent_value_out: 1_999_000_000,
            joinsplit_count: 0,
            sapling_spends: 0,
            sapling_outputs: 0,
            orchard_actions: 0,
            ironwood_actions: 1,
            sapling_value_balance: 0,
            orchard_value_balance: 0,
            ironwood_value_balance: 1_999_000_000,
            orchard_anchor: None,
            ironwood_anchor: None,
            fee: Some(0),
            vin: vec![],
            vout: vec![],
        };
        let deshield_flows = ShieldedFlow::from_transaction(&deshield);
        assert_eq!(deshield_flows.len(), 1);
        assert_eq!(deshield_flows[0].pool, "ironwood");
        assert_eq!(deshield_flows[0].flow_type, "deshield");
    }

    #[test]
    fn test_fully_shielded_tx_produces_no_flow() {
        let tx = Transaction {
            txid: "fully_shielded".to_string(),
            block_height: 3244398,
            block_hash: "hash".to_string(),
            version: 5,
            lock_time: 0,
            expiry_height: None,
            size: 200,
            vin_count: 0,
            vout_count: 0,
            transparent_value_in: 0,
            transparent_value_out: 0,
            joinsplit_count: 0,
            sapling_spends: 0,
            sapling_outputs: 0,
            orchard_actions: 2,
            ironwood_actions: 0,
            sapling_value_balance: 0,
            orchard_value_balance: 10000, // fee only
            ironwood_value_balance: 0,
            orchard_anchor: None,
            ironwood_anchor: None,
            fee: Some(10000),
            vin: vec![],
            vout: vec![],
        };

        let flows = ShieldedFlow::from_transaction(&tx);
        assert!(
            flows.is_empty(),
            "Fully shielded tx should produce no flows"
        );
    }

    #[test]
    fn test_pool_migration_produces_no_flow() {
        // Pool migrations move value between shielded pools — they should NOT
        // create shield/deshield flows since no transparent value is involved.
        let tx = Transaction {
            txid: "pool_migration".to_string(),
            block_height: 3000000,
            block_hash: "hash".to_string(),
            version: 5,
            lock_time: 0,
            expiry_height: None,
            size: 500,
            vin_count: 0,
            vout_count: 0,
            transparent_value_in: 0,
            transparent_value_out: 0,
            joinsplit_count: 0,
            sapling_spends: 2,
            sapling_outputs: 0,
            orchard_actions: 2,
            ironwood_actions: 0,
            sapling_value_balance: 5000000, // 0.05 ZEC leaving Sapling
            orchard_value_balance: -4990000, // ~0.05 ZEC entering Orchard (minus fee)
            ironwood_value_balance: 0,
            orchard_anchor: None,
            ironwood_anchor: None,
            fee: Some(10000),
            vin: vec![],
            vout: vec![],
        };

        let flows = ShieldedFlow::from_transaction(&tx);
        assert!(
            flows.is_empty(),
            "Pool migration should NOT produce a shield/deshield flow"
        );
    }

    #[test]
    fn test_orchard_to_ironwood_migration_produces_no_flow() {
        // NU6.3 canonical migration: value leaves Orchard, enters Ironwood,
        // no transparent I/O. The net positive balance is just the fee.
        let tx = Transaction {
            txid: "orchard_to_ironwood".to_string(),
            block_height: 4200000,
            block_hash: "hash".to_string(),
            version: 6,
            lock_time: 0,
            expiry_height: None,
            size: 600,
            vin_count: 0,
            vout_count: 0,
            transparent_value_in: 0,
            transparent_value_out: 0,
            joinsplit_count: 0,
            sapling_spends: 0,
            sapling_outputs: 0,
            orchard_actions: 2,
            ironwood_actions: 2,
            sapling_value_balance: 0,
            orchard_value_balance: 10010000, // 0.1 ZEC + fee leaving Orchard
            ironwood_value_balance: -10000000, // 0.1 ZEC entering Ironwood
            orchard_anchor: None,
            ironwood_anchor: None,
            fee: Some(10000),
            vin: vec![],
            vout: vec![],
        };

        let flows = ShieldedFlow::from_transaction(&tx);
        assert!(
            flows.is_empty(),
            "Orchard→Ironwood migration should NOT produce a shield/deshield flow"
        );
    }
}
