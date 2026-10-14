//! Configuration for the WcashScan Rust indexer.

use std::env;
use std::path::PathBuf;

/// Main configuration struct
#[derive(Debug, Clone)]
pub struct Config {
    /// Path to W.cash Wolf's RocksDB state
    pub zebra_state_path: PathBuf,

    /// Selects the canonical block source. RPC is the portable default and
    /// works with an isolated W.cash regtest node; RocksDB is an explicit
    /// operator optimization for a colocated Wolf process.
    pub source_mode: SourceMode,

    /// PostgreSQL connection URL
    pub database_url: String,

    /// Batch size for PostgreSQL inserts
    pub batch_size: usize,

    /// Whether we're in mainnet or testnet
    pub network: Network,

    /// W.cash profile selected by the operator, such as `wcash-testnet-v5` or
    /// `wcash-regtest`.
    pub chain_profile: String,

    /// Genesis hash that must be returned by the node before any writes.
    /// `None` is only valid for an explicitly configured, not-yet-launched
    /// mainnet profile.
    pub expected_genesis_hash: Option<String>,

    /// Consensus branch ID that should be embedded in post-upgrade
    /// transactions. It is recorded for diagnostics and preflight checks.
    pub expected_branch_id: Option<String>,

    /// Maximum RocksDB open files (to avoid ulimit issues)
    pub max_open_files: i32,

    /// W.cash Wolf gRPC indexer URL (e.g. "http://127.0.0.1:8230")
    /// When set, enables instant block notifications instead of 30s polling
    pub zebra_grpc_url: Option<String>,

    /// Maximum reorg depth the indexer will handle automatically.
    /// Reorgs deeper than this require manual intervention (mainnet safety).
    /// Testnet should use a higher value since deep reorgs are routine.
    pub max_reorg_depth: u32,

    /// Maximum encoded blocks retained in the in-memory gRPC payload cache.
    pub grpc_payload_cache_blocks: usize,

    /// Maximum bytes retained in the in-memory gRPC payload cache.
    pub grpc_payload_cache_bytes: usize,

    /// Time to wait for a matching full-block payload after a tip event.
    pub grpc_payload_wait_ms: u64,

    /// Opt-in for NonFinalizedStateChange after shadow verification succeeds.
    pub enable_full_block_grpc: bool,

    /// Directory for the bounded recent-block reorg spool.
    pub block_spool_path: PathBuf,

    /// Encoded blocks that may be prefetched while ordered writes commit.
    pub live_pipeline_capacity: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Network {
    Mainnet,
    Testnet,
    Regtest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceMode {
    Rpc,
    RocksDb,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            zebra_state_path: PathBuf::from("/var/lib/wcash/wolf/state/testnet"),
            source_mode: SourceMode::Rpc,
            database_url: String::from("postgres://localhost/wcashscan_testnet_v5"),
            batch_size: 1000,
            network: Network::Testnet,
            chain_profile: String::from("wcash-testnet-v5"),
            expected_genesis_hash: Some(String::from(
                "0271b5b0a10b2838f43cccdec9ca2f72aa72a7c103830082bac8f82f47f0593a",
            )),
            expected_branch_id: Some(String::from("b3cfd27e")),
            max_open_files: 256,
            zebra_grpc_url: None,
            max_reorg_depth: 100,
            grpc_payload_cache_blocks: 32,
            grpc_payload_cache_bytes: 64 * 1024 * 1024,
            grpc_payload_wait_ms: 1_500,
            enable_full_block_grpc: false,
            block_spool_path: PathBuf::from("/var/lib/wcash/wcashscan/block-spool"),
            live_pipeline_capacity: 4,
        }
    }
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, String> {
        let mut config = Self::default();

        // Wolf state path
        if let Ok(path) = env::var("WCASH_STATE_PATH") {
            config.zebra_state_path = PathBuf::from(path);
        }

        // Database URL
        if let Ok(url) = env::var("WCASH_DATABASE_URL").or_else(|_| env::var("DATABASE_URL")) {
            config.database_url = url;
        }

        let source = env::var("WCASH_SOURCE")
            .or_else(|_| env::var("WCASH_RPC_SOURCE"))
            .unwrap_or_else(|_| "rpc".to_string());
        config.source_mode = match source.trim().to_ascii_lowercase().as_str() {
            "rocks" | "rocksdb" | "state" => SourceMode::RocksDb,
            _ => SourceMode::Rpc,
        };

        // Batch size
        if let Ok(size) = env::var("BATCH_SIZE") {
            if let Ok(n) = size.parse() {
                config.batch_size = n;
            }
        }

        // Network detection (from path or explicit)
        let profile = env::var("WCASH_CHAIN").unwrap_or_else(|_| config.chain_profile.clone());
        config.set_chain_profile(&profile)?;

        if let Ok(genesis) = env::var("WCASH_EXPECTED_GENESIS") {
            let genesis = genesis.trim().to_ascii_lowercase();
            if !genesis.is_empty() {
                config.expected_genesis_hash = Some(genesis);
            }
        }
        if let Ok(branch) = env::var("WCASH_EXPECTED_BRANCH_ID") {
            let branch = branch.trim().to_ascii_lowercase();
            if !branch.is_empty() {
                config.expected_branch_id = Some(branch);
            }
        }

        if let Ok(url) = env::var("WCASH_INDEXER_GRPC_URL") {
            let url = url.trim().to_string();
            if !url.is_empty() {
                config.zebra_grpc_url = Some(if url.starts_with("http") {
                    url
                } else {
                    format!("http://{}", url)
                });
            }
        }

        if let Ok(val) = env::var("MAX_REORG_DEPTH") {
            if let Ok(n) = val.parse::<u32>() {
                config.max_reorg_depth = n;
            }
        }
        if let Ok(val) = env::var("GRPC_PAYLOAD_CACHE_BLOCKS") {
            if let Ok(n) = val.parse::<usize>() {
                if n > 0 {
                    config.grpc_payload_cache_blocks = n;
                }
            }
        }
        if let Ok(val) = env::var("GRPC_PAYLOAD_CACHE_BYTES") {
            if let Ok(n) = val.parse::<usize>() {
                if n > 0 {
                    config.grpc_payload_cache_bytes = n;
                }
            }
        }
        if let Ok(val) = env::var("GRPC_PAYLOAD_WAIT_MS") {
            if let Ok(n) = val.parse::<u64>() {
                config.grpc_payload_wait_ms = n;
            }
        }
        if let Ok(value) = env::var("ENABLE_FULL_BLOCK_GRPC") {
            config.enable_full_block_grpc =
                matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes");
        }
        if let Ok(path) = env::var("BLOCK_SPOOL_PATH") {
            if !path.trim().is_empty() {
                config.block_spool_path = PathBuf::from(path);
            }
        }
        if let Ok(value) = env::var("LIVE_PIPELINE_CAPACITY") {
            if let Ok(capacity) = value.parse::<usize>() {
                if (1..=64).contains(&capacity) {
                    config.live_pipeline_capacity = capacity;
                }
            }
        }

        Ok(config)
    }

    /// Get display name for the network
    pub fn network_name(&self) -> &'static str {
        match self.network {
            Network::Mainnet => "mainnet",
            Network::Testnet => "testnet",
            Network::Regtest => "regtest",
        }
    }

    /// Apply a named W.cash profile. Unknown names fail closed instead of
    /// silently selecting the public testnet or indexing an unrelated chain.
    pub fn set_chain_profile(&mut self, profile: &str) -> Result<(), String> {
        let normalized = profile.trim().to_ascii_lowercase();
        match normalized.as_str() {
            "wcash-regtest" | "regtest" => {
                self.chain_profile = "wcash-regtest".to_string();
                self.network = Network::Regtest;
                self.expected_genesis_hash = Some(
                    "70bf0bab17eff361a6331bb825b3b7253c8c96ff96407f948161d2912658bb1c".to_string(),
                );
                self.expected_branch_id = Some("c3a6678a".to_string());
            }
            "wcash-mainnet" | "mainnet" => {
                self.chain_profile = "wcash-mainnet".to_string();
                self.network = Network::Mainnet;
                // Mainnet is intentionally not launched in this repository.
                // An operator must supply its frozen genesis before enabling
                // a live mainnet indexer.
                self.expected_genesis_hash = None;
                self.expected_branch_id = None;
            }
            "wcash-testnet-v5" | "testnet" => {
                self.chain_profile = "wcash-testnet-v5".to_string();
                self.network = Network::Testnet;
                self.expected_genesis_hash = Some(
                    "0271b5b0a10b2838f43cccdec9ca2f72aa72a7c103830082bac8f82f47f0593a".to_string(),
                );
                self.expected_branch_id = Some("b3cfd27e".to_string());
            }
            _ => {
                return Err(format!(
                    "unknown W.cash chain profile '{profile}'; expected wcash-testnet-v5 or wcash-regtest"
                ));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.network, Network::Testnet);
        assert_eq!(config.source_mode, SourceMode::Rpc);
        assert_eq!(config.batch_size, 1000);
    }

    #[test]
    fn regtest_profile_is_isolated() {
        let mut config = Config::default();
        config.set_chain_profile("regtest").unwrap();
        assert_eq!(config.network, Network::Regtest);
        assert_eq!(config.chain_profile, "wcash-regtest");
        assert_eq!(config.expected_branch_id.as_deref(), Some("c3a6678a"));
    }
}
