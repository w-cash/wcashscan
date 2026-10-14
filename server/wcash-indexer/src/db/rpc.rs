//! Wolf JSON-RPC client.
//!
//! Used for live mode to get real-time block updates.
//! Falls back from RocksDB secondary mode when that doesn't work.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

/// W.cash node RPC client. Authentication is read on every request so a Wolf
/// cookie rotation never requires restarting the indexer.
#[derive(Clone)]
pub struct ZebraRpc {
    client: Client,
    url: String,
    cookie_file: Option<PathBuf>,
    user: Option<String>,
    password: Option<String>,
}

#[derive(Serialize)]
struct RpcRequest<'a> {
    jsonrpc: &'a str,
    id: &'a str,
    method: &'a str,
    params: Vec<serde_json::Value>,
}

#[derive(Deserialize, Debug)]
struct RpcResponse<T> {
    result: Option<T>,
    error: Option<RpcError>,
}

#[derive(Deserialize, Debug)]
struct RpcError {
    code: i32,
    message: String,
}

#[derive(Deserialize, Debug)]
pub struct BlockInfo {
    pub hash: String,
    pub time: u64,
    #[serde(default)]
    pub difficulty: f64,
    #[serde(default)]
    pub finalsaplingroot: Option<String>,
    #[serde(default)]
    pub finalorchardroot: Option<String>,
    #[serde(default)]
    pub finalironwoodroot: Option<String>,
    #[serde(default)]
    pub previousblockhash: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
}

impl ZebraRpc {
    const MAX_RESPONSE_BYTES: usize = 32 * 1024 * 1024;

    /// Create new RPC client from environment
    pub fn from_env() -> Result<Self, String> {
        let default_port = if std::env::var("WCASH_CHAIN")
            .map(|value| {
                value.eq_ignore_ascii_case("regtest") || value.eq_ignore_ascii_case("wcash-regtest")
            })
            .unwrap_or(false)
        {
            48232
        } else {
            38232
        };
        let url = std::env::var("WCASH_RPC_URL")
            .unwrap_or_else(|_| format!("http://127.0.0.1:{default_port}"));

        let cookie_file = std::env::var("WCASH_RPC_COOKIE_FILE")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from);
        let user = std::env::var("WCASH_RPC_USER").ok();
        let password = std::env::var("WCASH_RPC_PASSWORD").ok();

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        Ok(Self {
            client,
            url,
            cookie_file,
            user,
            password,
        })
    }

    fn auth(&self) -> Option<(String, String)> {
        if let Some(path) = &self.cookie_file {
            if let Ok(cookie) = std::fs::read_to_string(path) {
                let mut parts = cookie.trim().splitn(2, ':');
                if let (Some(user), Some(password)) = (parts.next(), parts.next()) {
                    return Some((user.to_string(), password.to_string()));
                }
            }
        }
        self.user.clone().zip(self.password.clone())
    }

    /// Make an RPC call
    async fn call<T: for<'de> Deserialize<'de>>(
        &self,
        method: &str,
        params: Vec<serde_json::Value>,
    ) -> Result<T, String> {
        let request = RpcRequest {
            jsonrpc: "1.0",
            id: "wcashscan-indexer",
            method,
            params,
        };

        let mut req = self.client.post(&self.url).json(&request);

        if let Some((user, pass)) = self.auth() {
            req = req.basic_auth(user, Some(pass));
        }

        let response = req
            .send()
            .await
            .map_err(|e| format!("RPC request failed: {}", e))?;

        let status = response.status();
        let body = response
            .bytes()
            .await
            .map_err(|e| format!("RPC response read failed: {}", e))?;
        if body.len() > Self::MAX_RESPONSE_BYTES {
            return Err(format!(
                "RPC response exceeded the {} MiB safety limit",
                Self::MAX_RESPONSE_BYTES / (1024 * 1024)
            ));
        }
        if !status.is_success() {
            return Err(format!(
                "RPC HTTP status {}: {}",
                status,
                String::from_utf8_lossy(&body)
                    .chars()
                    .take(240)
                    .collect::<String>()
            ));
        }

        let rpc_response: RpcResponse<T> =
            serde_json::from_slice(&body).map_err(|e| format!("RPC parse failed: {}", e))?;

        if let Some(err) = rpc_response.error {
            return Err(format!("RPC error {}: {}", err.code, err.message));
        }

        rpc_response
            .result
            .ok_or_else(|| "RPC returned no result".to_string())
    }

    /// Get current blockchain height
    pub async fn get_block_count(&self) -> Result<u64, String> {
        self.call("getblockcount", vec![]).await
    }

    /// Get block hash at height
    pub async fn get_block_hash(&self, height: u64) -> Result<String, String> {
        self.call("getblockhash", vec![serde_json::json!(height)])
            .await
    }

    /// Get block info by hash
    pub async fn get_block(&self, hash: &str) -> Result<BlockInfo, String> {
        self.call(
            "getblock",
            vec![serde_json::json!(hash), serde_json::json!(1)],
        )
        .await
    }

    /// Get block info by height
    pub async fn get_block_by_height(&self, height: u64) -> Result<BlockInfo, String> {
        let hash = self.get_block_hash(height).await?;
        self.get_block(&hash).await
    }

    /// Get full raw block as hex (verbosity 0)
    pub async fn get_raw_block_hex(&self, hash: &str) -> Result<String, String> {
        self.call(
            "getblock",
            vec![serde_json::json!(hash), serde_json::json!(0)],
        )
        .await
    }

    /// Get raw transaction hex
    pub async fn get_raw_transaction_hex(&self, txid: &str) -> Result<String, String> {
        self.call(
            "getrawtransaction",
            vec![serde_json::json!(txid), serde_json::json!(0)],
        )
        .await
    }

    /// Get blockchain info (includes valuePools with authoritative pool balances)
    pub async fn get_blockchain_info(&self) -> Result<serde_json::Value, String> {
        self.call("getblockchaininfo", vec![]).await
    }

    /// Validate the node's genesis before the indexer writes anything. The
    /// genesis is fetched by height rather than trusting a user-supplied
    /// `chain` label, so a Zcash node cannot be mistaken for W.cash.
    pub async fn verify_genesis(&self, expected: Option<&str>) -> Result<String, String> {
        let actual = self.get_block_hash(0).await?.to_ascii_lowercase();
        if let Some(expected) = expected {
            if actual != expected.to_ascii_lowercase() {
                return Err(format!(
                    "W.cash genesis mismatch: expected {}, node returned {}",
                    expected, actual
                ));
            }
        }
        Ok(actual)
    }
}
