use sqlx::Pool;
use std::collections::HashMap;
use tokio::sync::Mutex;

use crate::models::ConnectionConfig;
use crate::ssh::SshTunnel;

pub mod mysql;
pub mod postgres;
pub mod sqlite;

pub enum DbPool {
    MySql(Pool<sqlx::MySql>),
    Postgres(Pool<sqlx::Postgres>),
    Sqlite(Pool<sqlx::Sqlite>),
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
            _ => return Err(format!("Unsupported database type: {}", config.conn_type)),
        };

        // Test the connection with a simple query
        match &pool {
            DbPool::MySql(p) => {
                sqlx::query("SELECT 1").fetch_one(p).await.map_err(|e| e.to_string())?;
            }
            DbPool::Postgres(p) => {
                sqlx::query("SELECT 1").fetch_one(p).await.map_err(|e| e.to_string())?;
            }
            DbPool::Sqlite(p) => {
                sqlx::query("SELECT 1").fetch_one(p).await.map_err(|e| e.to_string())?;
            }
        }

        // Close the pool immediately after test
        match pool {
            DbPool::MySql(p) => p.close().await,
            DbPool::Postgres(p) => p.close().await,
            DbPool::Sqlite(p) => p.close().await,
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
            None => Err("Connection not found".to_string()),
        }
    }

    pub async fn list_databases(&self, id: &str) -> Result<Vec<String>, String> {
        let pool = self.get_pool(id).await?;
        match pool {
            DbPool::MySql(p) => mysql::list_databases(&p).await,
            DbPool::Postgres(p) => postgres::list_databases(&p).await,
            DbPool::Sqlite(p) => sqlite::list_databases(&p).await,
        }
    }

    pub async fn list_tables(&self, id: &str, database: &str) -> Result<Vec<TableInfo>, String> {
        let pool = self.get_pool(id).await?;
        match pool {
            DbPool::MySql(p) => mysql::list_tables(&p, database).await,
            DbPool::Postgres(p) => postgres::list_tables(&p, database).await,
            DbPool::Sqlite(p) => sqlite::list_tables(&p, database).await,
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
