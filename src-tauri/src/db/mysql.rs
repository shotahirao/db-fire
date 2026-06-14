use sqlx::{mysql::MySqlRow, Column, MySqlPool, Row, TypeInfo};

use crate::db::{ColumnInfo, QueryResult, TableInfo};
use crate::models::ConnectionConfig;

pub async fn connect(config: &ConnectionConfig) -> Result<MySqlPool, String> {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(3306);
    let user = config.username.as_deref().unwrap_or("root");
    let password = config.password.as_deref().unwrap_or("");
    let database = config.database.as_deref().unwrap_or("");

    let url = format!(
        "mysql://{}:{}@{}:{}/{}?charset=utf8mb4",
        user, password, host, port, database
    );

    MySqlPool::connect(&url)
        .await
        .map_err(|e| format!("MySQL connection failed: {}", e))
}

pub async fn list_databases(pool: &MySqlPool) -> Result<Vec<String>, String> {
    let rows: Vec<MySqlRow> = sqlx::query(
        "SELECT CAST(SCHEMA_NAME AS CHAR) AS name FROM information_schema.schemata WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys') ORDER BY SCHEMA_NAME"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut databases = Vec::new();
    for row in rows {
        let name: String = row.try_get("name").map_err(|e| e.to_string())?;
        databases.push(name);
    }
    Ok(databases)
}

pub async fn list_tables(pool: &MySqlPool, database: &str) -> Result<Vec<TableInfo>, String> {
    let rows: Vec<MySqlRow> = sqlx::query(
        "SELECT \
            CAST(t.TABLE_NAME AS CHAR) AS table_name, \
            CAST(c.COLUMN_NAME AS CHAR) AS column_name, \
            CAST(c.DATA_TYPE AS CHAR) AS data_type, \
            CAST(c.IS_NULLABLE AS CHAR) AS is_nullable, \
            CAST(c.COLUMN_DEFAULT AS CHAR) AS default_value, \
            CAST(c.COLUMN_KEY AS CHAR) AS column_key \
        FROM information_schema.TABLES t \
        LEFT JOIN information_schema.COLUMNS c \
          ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME \
        WHERE t.TABLE_SCHEMA = ? AND t.TABLE_TYPE = 'BASE TABLE' \
        ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION"
    )
    .bind(database)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut tables: Vec<TableInfo> = Vec::new();
    for row in rows {
        let table_name: String = row.try_get("table_name").map_err(|e| e.to_string())?;
        let column_name: Option<String> = row.try_get("column_name").ok();

        if tables.last().map(|t| t.name != table_name).unwrap_or(true) {
            tables.push(TableInfo {
                name: table_name.clone(),
                schema: Some(database.to_string()),
                columns: vec![],
            });
        }

        if let Some(col_name) = column_name {
            let data_type: String = row.try_get("data_type").map_err(|e| e.to_string())?;
            let is_nullable: String = row.try_get("is_nullable").map_err(|e| e.to_string())?;
            let default_value: Option<String> = row.try_get("default_value").ok();
            let column_key: String = row.try_get("column_key").map_err(|e| e.to_string())?;

            if let Some(table) = tables.last_mut() {
                table.columns.push(ColumnInfo {
                    name: col_name,
                    data_type,
                    nullable: is_nullable == "YES",
                    default_value,
                    is_primary_key: column_key == "PRI",
                });
            }
        }
    }
    Ok(tables)
}

pub async fn get_table_schema(pool: &MySqlPool, database: &str, table: &str) -> Result<TableInfo, String> {
    let rows: Vec<MySqlRow> = sqlx::query(
        "SELECT CAST(COLUMN_NAME AS CHAR) AS name, CAST(DATA_TYPE AS CHAR) AS data_type, CAST(IS_NULLABLE AS CHAR) AS is_nullable, CAST(COLUMN_DEFAULT AS CHAR) AS default_value, CAST(COLUMN_KEY AS CHAR) AS column_key FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION"
    )
    .bind(database)
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut columns = Vec::new();
    for row in rows {
        let name: String = row.try_get("name").map_err(|e| e.to_string())?;
        let data_type: String = row.try_get("data_type").map_err(|e| e.to_string())?;
        let is_nullable: String = row.try_get("is_nullable").map_err(|e| e.to_string())?;
        let default_value: Option<String> = row.try_get("default_value").ok();
        let column_key: String = row.try_get("column_key").map_err(|e| e.to_string())?;

        columns.push(ColumnInfo {
            name,
            data_type,
            nullable: is_nullable == "YES",
            default_value,
            is_primary_key: column_key == "PRI",
        });
    }

    Ok(TableInfo {
        name: table.to_string(),
        schema: Some(database.to_string()),
        columns,
    })
}

pub async fn execute_query(pool: &MySqlPool, sql: &str) -> Result<QueryResult, String> {
    let trimmed = sql.trim().to_uppercase();
    if trimmed.starts_with("SELECT") || trimmed.starts_with("SHOW") || trimmed.starts_with("DESCRIBE") {
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

pub async fn execute_raw(pool: &MySqlPool, sql: &str) -> Result<u64, String> {
    let result = sqlx::query(sql)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

pub async fn get_table_ddl(pool: &MySqlPool, _database: &str, table: &str) -> Result<String, String> {
    let row: MySqlRow = sqlx::query("SHOW CREATE TABLE ??")
        .bind(table)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    let ddl: String = row.try_get("Create Table").map_err(|e| e.to_string())?;
    Ok(ddl)
}

fn sql_to_json(row: &MySqlRow, index: usize) -> Result<serde_json::Value, sqlx::Error> {
    use serde_json::Value as JsonValue;

    let type_info = row.column(index).type_info().name();
    match type_info {
        "INT" | "BIGINT" | "TINYINT" | "SMALLINT" | "MEDIUMINT" => {
            let v: Option<i64> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |n| JsonValue::Number(n.into())))
        }
        "FLOAT" | "DOUBLE" | "DECIMAL" => {
            let v: Option<f64> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |n| JsonValue::Number(serde_json::Number::from_f64(n).unwrap_or(0.into()))))
        }
        "BOOLEAN" => {
            let v: Option<bool> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, JsonValue::Bool))
        }
        "JSON" => {
            let v: Option<serde_json::Value> = row.try_get(index)?;
            Ok(v.unwrap_or(JsonValue::Null))
        }
        "DATETIME" | "TIMESTAMP" => {
            let v: Option<chrono::NaiveDateTime> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |dt| JsonValue::String(dt.to_string())))
        }
        "DATE" => {
            let v: Option<chrono::NaiveDate> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |d| JsonValue::String(d.to_string())))
        }
        "TIME" => {
            let v: Option<chrono::NaiveTime> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, |t| JsonValue::String(t.to_string())))
        }
        _ => {
            let v: Option<String> = row.try_get(index)?;
            Ok(v.map_or(JsonValue::Null, JsonValue::String))
        }
    }
}
