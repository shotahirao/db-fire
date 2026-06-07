use sqlx::{sqlite::SqliteRow, Column, SqlitePool, Row};

use crate::db::{ColumnInfo, QueryResult, TableInfo};
use crate::models::ConnectionConfig;

pub async fn connect(config: &ConnectionConfig) -> Result<SqlitePool, String> {
    let file_path = config.file_path.as_deref().unwrap_or(":memory:");

    let url = if file_path == ":memory:" {
        "sqlite::memory:".to_string()
    } else {
        format!("sqlite://{}", file_path)
    };

    SqlitePool::connect(&url)
        .await
        .map_err(|e| format!("SQLite connection failed: {}", e))
}

pub async fn list_databases(_pool: &SqlitePool) -> Result<Vec<String>, String> {
    Ok(vec!["main".to_string()])
}

pub async fn list_tables(pool: &SqlitePool, _database: &str) -> Result<Vec<TableInfo>, String> {
    let rows: Vec<SqliteRow> = sqlx::query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for row in rows {
        let name: String = row.try_get("name").map_err(|e| e.to_string())?;
        tables.push(TableInfo {
            name,
            schema: Some("main".to_string()),
            columns: vec![],
        });
    }
    Ok(tables)
}

pub async fn get_table_schema(pool: &SqlitePool, _database: &str, table: &str) -> Result<TableInfo, String> {
    let rows: Vec<SqliteRow> = sqlx::query("PRAGMA table_info( ? )")
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut columns = Vec::new();
    for row in rows {
        let name: String = row.try_get("name").map_err(|e| e.to_string())?;
        let data_type: String = row.try_get("type").map_err(|e| e.to_string())?;
        let notnull: i32 = row.try_get("notnull").map_err(|e| e.to_string())?;
        let default_value: Option<String> = row.try_get("dflt_value").ok();
        let pk: i32 = row.try_get("pk").map_err(|e| e.to_string())?;

        columns.push(ColumnInfo {
            name,
            data_type,
            nullable: notnull == 0,
            default_value,
            is_primary_key: pk > 0,
        });
    }

    Ok(TableInfo {
        name: table.to_string(),
        schema: Some("main".to_string()),
        columns,
    })
}

pub async fn execute_query(pool: &SqlitePool, sql: &str) -> Result<QueryResult, String> {
    let trimmed = sql.trim().to_uppercase();
    if trimmed.starts_with("SELECT") || trimmed.starts_with("PRAGMA") {
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

fn sql_to_json(row: &SqliteRow, index: usize) -> Result<serde_json::Value, sqlx::Error> {
    use serde_json::Value as JsonValue;

    if let Ok(v) = row.try_get::<Option<i64>, _>(index) {
        return Ok(v.map_or(JsonValue::Null, |n| JsonValue::Number(n.into())));
    }
    if let Ok(v) = row.try_get::<Option<f64>, _>(index) {
        return Ok(v.map_or(JsonValue::Null, |n| JsonValue::Number(serde_json::Number::from_f64(n).unwrap_or(0.into()))));
    }
    if let Ok(v) = row.try_get::<Option<String>, _>(index) {
        return Ok(v.map_or(JsonValue::Null, JsonValue::String));
    }
    if let Ok(v) = row.try_get::<Option<bool>, _>(index) {
        return Ok(v.map_or(JsonValue::Null, JsonValue::Bool));
    }
    if let Ok(v) = row.try_get::<Option<chrono::NaiveDateTime>, _>(index) {
        return Ok(v.map_or(JsonValue::Null, |dt| JsonValue::String(dt.to_string())));
    }
    if let Ok(v) = row.try_get::<Option<chrono::NaiveDate>, _>(index) {
        return Ok(v.map_or(JsonValue::Null, |d| JsonValue::String(d.to_string())));
    }
    if let Ok(v) = row.try_get::<Option<chrono::NaiveTime>, _>(index) {
        return Ok(v.map_or(JsonValue::Null, |t| JsonValue::String(t.to_string())));
    }
    Ok(JsonValue::Null)
}

pub async fn execute_raw(pool: &SqlitePool, sql: &str) -> Result<u64, String> {
    let result = sqlx::query(sql)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

pub async fn get_table_ddl(pool: &SqlitePool, _database: &str, table: &str) -> Result<String, String> {
    let ddl: String = sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
        .bind(table)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(ddl)
}
