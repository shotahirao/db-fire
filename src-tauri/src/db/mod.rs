use sqlx::Pool;
use std::collections::HashMap;
use tokio::sync::Mutex;

use crate::db::duckdb::Connection as DuckDbConnection;
use crate::db::duckdb as duckdb_db;
use crate::models::ConnectionConfig;
use crate::ssh::SshTunnel;

pub mod mysql;
pub mod postgres;
pub mod sqlite;
pub mod duckdb;

pub enum DbPool {
    MySql(Pool<sqlx::MySql>),
    Postgres(Pool<sqlx::Postgres>),
    Sqlite(Pool<sqlx::Sqlite>),
    DuckDb(std::sync::Arc<std::sync::Mutex<DuckDbConnection>>),
}

/// SQL文が結果セットを返すかどうかを先頭キーワードで判定する。
/// 先頭の空白・コメント(`--` / `/* */`)を除去してから判定するため、
/// CTE (`WITH ... SELECT`) やコメント付きクエリも正しく分類される。
pub fn returns_rows(sql: &str) -> bool {
    let mut rest = sql.trim_start();
    loop {
        if let Some(stripped) = rest.strip_prefix("--") {
            rest = match stripped.find('\n') {
                Some(i) => stripped[i + 1..].trim_start(),
                None => "",
            };
        } else if let Some(stripped) = rest.strip_prefix("/*") {
            rest = match stripped.find("*/") {
                Some(i) => stripped[i + 2..].trim_start(),
                None => "",
            };
        } else {
            break;
        }
    }
    let keyword: String = rest
        .chars()
        .take_while(|c| c.is_ascii_alphabetic())
        .collect::<String>()
        .to_ascii_uppercase();
    matches!(
        keyword.as_str(),
        "SELECT" | "WITH" | "SHOW" | "EXPLAIN" | "DESCRIBE" | "DESC" | "PRAGMA" | "VALUES" | "TABLE"
    )
}

/// DuckDB接続のロック取得。毒化していても内部値を取り出して継続する
/// （一度のpanicで以後の全DuckDB操作が死ぬのを防ぐ）。
fn lock_duckdb(
    c: &std::sync::Arc<std::sync::Mutex<DuckDbConnection>>,
) -> std::sync::MutexGuard<'_, DuckDbConnection> {
    c.lock().unwrap_or_else(|e| e.into_inner())
}

pub struct ConnectionManager {
    pools: Mutex<HashMap<String, DbPool>>,
    ssh_tunnels: Mutex<HashMap<String, SshTunnel>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            pools: Mutex::new(HashMap::new()),
            ssh_tunnels: Mutex::new(HashMap::new()),
        }
    }

    async fn build_effective_config(&self, config: &ConnectionConfig) -> Result<(ConnectionConfig, Option<SshTunnel>), String> {
        let mut effective_config = config.clone();
        let mut tunnel = None;

        if config.ssh_enabled.unwrap_or(false) {
            let ssh_host = config.ssh_host.as_deref().ok_or("SSH host not configured")?;
            let ssh_port = config.ssh_port.unwrap_or(22);
            let ssh_user = config.ssh_user.as_deref().ok_or("SSH user not configured")?;
            let ssh_key = config.ssh_private_key.as_deref();
            let db_host = config.host.as_deref().unwrap_or("localhost");
            let db_port = config.port.unwrap_or(3306);

            let t = SshTunnel::connect(
                ssh_host,
                ssh_port,
                ssh_user,
                ssh_key,
                db_host,
                db_port,
            )
            .await?;

            let local_port = t.local_port();
            effective_config.host = Some("127.0.0.1".to_string());
            effective_config.port = Some(local_port);
            tunnel = Some(t);
        }

        Ok((effective_config, tunnel))
    }

    pub async fn test_connection(&self, config: &ConnectionConfig) -> Result<(), String> {
        let (effective_config, _tunnel) = self.build_effective_config(config).await?;

        match config.conn_type.as_str() {
            "mysql" => {
                let pool = mysql::connect(&effective_config).await?;
                sqlx::query("SELECT 1").fetch_one(&pool).await.map_err(|e| e.to_string())?;
                pool.close().await;
            }
            "postgres" => {
                let pool = postgres::connect(&effective_config).await?;
                sqlx::query("SELECT 1").fetch_one(&pool).await.map_err(|e| e.to_string())?;
                pool.close().await;
            }
            "sqlite" => {
                let pool = sqlite::connect(&effective_config).await?;
                sqlx::query("SELECT 1").fetch_one(&pool).await.map_err(|e| e.to_string())?;
                pool.close().await;
            }
            "duckdb" => {
                let config = effective_config.clone();
                tokio::task::spawn_blocking(move || {
                    let conn = duckdb_db::connect(&config)?;
                    conn.execute("SELECT 1", []).map_err(|e| e.to_string())?;
                    Ok::<(), String>(())
                })
                .await
                .map_err(|e| e.to_string())??;
            }
            _ => return Err(format!("Unsupported database type: {}", config.conn_type)),
        }

        Ok(())
    }

    pub async fn connect(&self, config: &ConnectionConfig) -> Result<(), String> {
        let mut pools = self.pools.lock().await;
        if pools.contains_key(&config.id) {
            return Ok(());
        }

        let (effective_config, tunnel) = self.build_effective_config(config).await?;

        if let Some(t) = tunnel {
            let mut tunnels = self.ssh_tunnels.lock().await;
            tunnels.insert(config.id.clone(), t);
        }

        let pool = match config.conn_type.as_str() {
            "mysql" => {
                let pool = mysql::connect(&effective_config).await?;
                DbPool::MySql(pool)
            }
            "postgres" => {
                let pool = postgres::connect(&effective_config).await?;
                DbPool::Postgres(pool)
            }
            "sqlite" => {
                let pool = sqlite::connect(&effective_config).await?;
                DbPool::Sqlite(pool)
            }
            "duckdb" => {
                let config = effective_config.clone();
                let conn = tokio::task::spawn_blocking(move || duckdb_db::connect(&config))
                    .await
                    .map_err(|e| e.to_string())??;
                DbPool::DuckDb(std::sync::Arc::new(std::sync::Mutex::new(conn)))
            }
            _ => return Err(format!("Unsupported database type: {}", config.conn_type)),
        };

        pools.insert(config.id.clone(), pool);
        Ok(())
    }

    pub async fn disconnect(&self, id: &str) -> Result<(), String> {
        let mut pools = self.pools.lock().await;
        pools.remove(id);
        let mut tunnels = self.ssh_tunnels.lock().await;
        tunnels.remove(id);
        Ok(())
    }

    async fn get_pool(&self, id: &str) -> Result<DbPool, String> {
        let pools = self.pools.lock().await;
        match pools.get(id) {
            Some(DbPool::MySql(p)) => Ok(DbPool::MySql(p.clone())),
            Some(DbPool::Postgres(p)) => Ok(DbPool::Postgres(p.clone())),
            Some(DbPool::Sqlite(p)) => Ok(DbPool::Sqlite(p.clone())),
            Some(DbPool::DuckDb(c)) => Ok(DbPool::DuckDb(c.clone())),
            None => Err("Connection not found".to_string()),
        }
    }

    pub async fn list_databases(&self, id: &str) -> Result<Vec<String>, String> {
        let pool = self.get_pool(id).await?;
        match pool {
            DbPool::MySql(p) => mysql::list_databases(&p).await,
            DbPool::Postgres(p) => postgres::list_databases(&p).await,
            DbPool::Sqlite(p) => sqlite::list_databases(&p).await,
            DbPool::DuckDb(c) => {
                tokio::task::spawn_blocking(move || duckdb_db::list_databases(&lock_duckdb(&c)))
                    .await
                    .map_err(|e| e.to_string())?
            }
        }
    }

    pub async fn list_tables(&self, id: &str, database: &str) -> Result<Vec<TableInfo>, String> {
        let pool = self.get_pool(id).await?;
        match pool {
            DbPool::MySql(p) => mysql::list_tables(&p, database).await,
            DbPool::Postgres(p) => postgres::list_tables(&p, database).await,
            DbPool::Sqlite(p) => sqlite::list_tables(&p, database).await,
            DbPool::DuckDb(c) => {
                let database = database.to_string();
                tokio::task::spawn_blocking(move || duckdb_db::list_tables(&lock_duckdb(&c), &database))
                    .await
                    .map_err(|e| e.to_string())?
            }
        }
    }

    pub async fn get_table_schema(
        &self,
        id: &str,
        database: &str,
        table: &str,
    ) -> Result<TableInfo, String> {
        let pool = self.get_pool(id).await?;
        match pool {
            DbPool::MySql(p) => mysql::get_table_schema(&p, database, table).await,
            DbPool::Postgres(p) => postgres::get_table_schema(&p, database, table).await,
            DbPool::Sqlite(p) => sqlite::get_table_schema(&p, database, table).await,
            DbPool::DuckDb(c) => {
                let database = database.to_string();
                let table = table.to_string();
                tokio::task::spawn_blocking(move || duckdb_db::get_table_schema(&lock_duckdb(&c), &database, &table))
                    .await
                    .map_err(|e| e.to_string())?
            }
        }
    }

    pub async fn execute_query(
        &self,
        id: &str,
        sql: &str,
    ) -> Result<QueryResult, String> {
        let pool = self.get_pool(id).await?;
        match pool {
            DbPool::MySql(p) => mysql::execute_query(&p, sql).await,
            DbPool::Postgres(p) => postgres::execute_query(&p, sql).await,
            DbPool::Sqlite(p) => sqlite::execute_query(&p, sql).await,
            DbPool::DuckDb(c) => {
                let sql = sql.to_string();
                tokio::task::spawn_blocking(move || duckdb_db::execute_query(&lock_duckdb(&c), &sql))
                    .await
                    .map_err(|e| e.to_string())?
            }
        }
    }

    pub async fn execute_raw(
        &self,
        id: &str,
        sql: &str,
    ) -> Result<u64, String> {
        let pool = self.get_pool(id).await?;
        match pool {
            DbPool::MySql(p) => mysql::execute_raw(&p, sql).await,
            DbPool::Postgres(p) => postgres::execute_raw(&p, sql).await,
            DbPool::Sqlite(p) => sqlite::execute_raw(&p, sql).await,
            DbPool::DuckDb(c) => {
                let sql = sql.to_string();
                tokio::task::spawn_blocking(move || duckdb_db::execute_raw(&lock_duckdb(&c), &sql))
                    .await
                    .map_err(|e| e.to_string())?
            }
        }
    }

    pub async fn get_table_ddl(
        &self,
        id: &str,
        database: &str,
        table: &str,
    ) -> Result<String, String> {
        let pool = self.get_pool(id).await?;
        match pool {
            DbPool::MySql(p) => mysql::get_table_ddl(&p, database, table).await,
            DbPool::Postgres(p) => postgres::get_table_ddl(&p, database, table).await,
            DbPool::Sqlite(p) => sqlite::get_table_ddl(&p, database, table).await,
            DbPool::DuckDb(c) => {
                let database = database.to_string();
                let table = table.to_string();
                tokio::task::spawn_blocking(move || duckdb_db::get_table_ddl(&lock_duckdb(&c), &database, &table))
                    .await
                    .map_err(|e| e.to_string())?
            }
        }
    }
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct TableInfo {
    pub name: String,
    pub schema: Option<String>,
    pub columns: Vec<ColumnInfo>,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub affected_rows: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::returns_rows;

    #[test]
    fn test_returns_rows() {
        assert!(returns_rows("SELECT * FROM t"));
        assert!(returns_rows("select 1"));
        assert!(returns_rows("  \n SELECT 1"));
        assert!(returns_rows("WITH t AS (SELECT 1) SELECT * FROM t"));
        assert!(returns_rows("-- comment\nSELECT 1"));
        assert!(returns_rows("/* block */ SELECT 1"));
        assert!(returns_rows("-- a\n-- b\n/* c */\nEXPLAIN SELECT 1"));
        assert!(returns_rows("SHOW TABLES"));
        assert!(returns_rows("PRAGMA table_info(\"t\")"));
        assert!(returns_rows("DESCRIBE t"));
        assert!(returns_rows("VALUES (1)"));

        assert!(!returns_rows("INSERT INTO t VALUES (1)"));
        assert!(!returns_rows("UPDATE t SET a = 1"));
        assert!(!returns_rows("DELETE FROM t"));
        assert!(!returns_rows("-- comment\nDROP TABLE t"));
        assert!(!returns_rows(""));
        assert!(!returns_rows("-- only a comment"));
    }
}
