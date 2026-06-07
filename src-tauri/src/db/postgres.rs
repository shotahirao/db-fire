use sqlx::{postgres::PgRow, Column, PgPool, Row, TypeInfo};

use crate::db::{ColumnInfo, QueryResult, TableInfo};
use crate::models::ConnectionConfig;

pub async fn connect(config: &ConnectionConfig) -> Result<PgPool, String> {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(5432);
    let user = config.username.as_deref().unwrap_or("postgres");
    let password = config.password.as_deref().unwrap_or("");
    let database = config.database.as_deref().unwrap_or("postgres");
    let ssl_mode = config.ssl_mode.as_deref().unwrap_or("prefer");

    let url = format!(
        "postgres://{}:{}@{}:{}/{}?sslmode={}",
        user, password, host, port, database, ssl_mode
    );

    PgPool::connect(&url)
        .await
        .map_err(|e| format!("PostgreSQL connection failed: {}", e))
}

pub async fn list_databases(pool: &PgPool) -> Result<Vec<String>, String> {
    let rows = sqlx::query_scalar::<_, String>(
        "SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres' ORDER BY datname"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

pub async fn list_tables(pool: &PgPool, database: &str) -> Result<Vec<TableInfo>, String> {
    let rows: Vec<PgRow> = sqlx::query(
        "SELECT table_name FROM information_schema.tables WHERE table_catalog = $1 AND table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
    )
    .bind(database)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for row in rows {
        let name: String = row.try_get("table_name").map_err(|e| e.to_string())?;
        tables.push(TableInfo {
            name,
            schema: Some("public".to_string()),
            columns: vec![],
        });
    }
    Ok(tables)
}

pub async fn get_table_schema(pool: &PgPool, _database: &str, table: &str) -> Result<TableInfo, String> {
    let rows: Vec<PgRow> = sqlx::query(
        "SELECT column_name, data_type, is_nullable, column_default, (SELECT COUNT(*) > 0 FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = c.table_name AND ccu.column_name = c.column_name) as is_primary FROM information_schema.columns c WHERE c.table_name = $1 AND c.table_schema = 'public' ORDER BY c.ordinal_position"
    )
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut columns = Vec::new();
    for row in rows {
        let name: String = row.try_get("column_name").map_err(|e| e.to_string())?;
        let data_type: String = row.try_get("data_type").map_err(|e| e.to_string())?;
        let is_nullable: String = row.try_get("is_nullable").map_err(|e| e.to_string())?;
        let default_value: Option<String> = row.try_get("column_default").ok();
        let is_primary: bool = row.try_get("is_primary").map_err(|e| e.to_string())?;

        columns.push(ColumnInfo {
            name,
            data_type,
            nullable: is_nullable == "YES",
            default_value,
            is_primary_key: is_primary,
        });
    }

    Ok(TableInfo {
        name: table.to_string(),
        schema: Some("public".to_string()),
        columns,
    })
}

pub async fn execute_query(pool: &PgPool, sql: &str) -> Result<QueryResult, String> {
    let trimmed = sql.trim().to_uppercase();
    if trimmed.starts_with("SELECT") || trimmed.starts_with("SHOW") || trimmed.starts_with("DESCRIBE") || trimmed.starts_with("EXPLAIN") {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

        let mut columns: Vec<String> = Vec::new();
        let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();

        if let Some(first) = rows.first() {
            columns = first.columns().iter().map(|c| c.name().to_string()).collect();
        }

        for row in rows {
            let mut result_row = Vec::new();
            for (i, _) in columns.iter().enumerate() {
                let val = sql_to_json(&row, i).map_err(|e| e.to_string())?;
                result_row.push(val);
            }
            result_rows.push(result_row);
        }

        Ok(QueryResult {
            columns,
            rows: result_rows,
            affected_rows: None,
        })
    } else {
        let result = sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
        })
    }
}

fn sql_to_json(row: &PgRow, index: usize) -> Result<serde_json::Value, sqlx::Error> {
    use serde_json::Value as JsonValue;

    let type_info = row.column(index).type_info().name();
    match type_info {
        "INT2" | "INT4" => {
            let v: Option<i32> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |n| JsonValue::Number(n.into())))
        }
        "INT8" => {
            let v: Option<i64> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |n| JsonValue::Number(n.into())))
        }
        "FLOAT4" | "FLOAT8" | "NUMERIC" => {
            let v: Option<f64> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |n| JsonValue::Number(serde_json::Number::from_f64(n).unwrap_or(0.into()))))
        }
        "BOOL" => {
            let v: Option<bool> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, JsonValue::Bool))
        }
        "JSON" | "JSONB" => {
            let v: Option<serde_json::Value> = row.try_get(index)?;
            Ok(v.unwrap_or(JsonValue::Null))
        }
        "TIMESTAMP" => {
            let v: Option<chrono::NaiveDateTime> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |dt| JsonValue::String(dt.to_string())))
        }
        "TIMESTAMPTZ" => {
            let v: Option<chrono::DateTime<chrono::Utc>> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |dt| JsonValue::String(dt.to_string())))
        }
        "DATE" => {
            let v: Option<chrono::NaiveDate> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |d| JsonValue::String(d.to_string())))
        }
        "TIME" | "TIMETZ" => {
            let v: Option<chrono::NaiveTime> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |t| JsonValue::String(t.to_string())))
        }
        _ => {
            let v: Option<String> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, JsonValue::String))
        }
    }
}

pub async fn execute_raw(pool: &PgPool, sql: &str) -> Result<u64, String> {
    let result = sqlx::query(sql)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

pub async fn get_table_ddl(pool: &PgPool, _database: &str, table: &str) -> Result<String, String> {
    let ddl: String = sqlx::query_scalar(
        "SELECT pg_catalog.pg_get_ddl(c.oid) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND n.nspname = 'public'"
    )
    .bind(table)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(ddl)
}
