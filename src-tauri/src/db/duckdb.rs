use duckdb::types::Value;
pub use duckdb::Connection;

use crate::db::{ColumnInfo, QueryResult, TableInfo};
use crate::models::ConnectionConfig;

pub fn connect(config: &ConnectionConfig) -> Result<Connection, String> {
    let path = config.file_path.as_deref().unwrap_or(":memory:");

    Connection::open(path)
        .map_err(|e| format!("DuckDB connection failed: {}", e))
}

pub fn list_databases(_conn: &Connection) -> Result<Vec<String>, String> {
    Ok(vec!["main".to_string()])
}

pub fn list_tables(conn: &Connection, _database: &str) -> Result<Vec<TableInfo>, String> {
    let sql = "SELECT \
        t.table_name, \
        c.column_name, \
        c.data_type, \
        c.is_nullable, \
        c.column_default, \
        c.is_nullable AS nullable \
    FROM information_schema.tables t \
    LEFT JOIN information_schema.columns c \
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema \
    WHERE t.table_schema = 'main' AND t.table_type = 'BASE TABLE' \
    ORDER BY t.table_name, c.ordinal_position";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>("table_name")?,
            row.get::<_, Option<String>>("column_name")?,
            row.get::<_, Option<String>>("data_type")?,
            row.get::<_, Option<String>>("is_nullable")?,
            row.get::<_, Option<String>>("column_default")?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut tables: Vec<TableInfo> = Vec::new();
    for row in rows {
        let (table_name, column_name, data_type, is_nullable, default_value) = row.map_err(|e| e.to_string())?;

        if tables.last().map(|t| t.name != table_name).unwrap_or(true) {
            tables.push(TableInfo {
                name: table_name.clone(),
                schema: Some("main".to_string()),
                columns: vec![],
            });
        }

        if let Some(col_name) = column_name {
            if let Some(table) = tables.last_mut() {
                table.columns.push(ColumnInfo {
                    name: col_name,
                    data_type: data_type.unwrap_or_default(),
                    nullable: is_nullable.as_deref() == Some("YES"),
                    default_value,
                    is_primary_key: false,
                });
            }
        }
    }

    Ok(tables)
}

pub fn get_table_schema(
    conn: &Connection,
    _database: &str,
    table: &str,
) -> Result<TableInfo, String> {
    let sql = "SELECT \
        column_name, \
        data_type, \
        is_nullable, \
        column_default \
    FROM information_schema.columns \
    WHERE table_schema = 'main' AND table_name = ? \
    ORDER BY ordinal_position";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([table], |row| {
        Ok((
            row.get::<_, String>("column_name")?,
            row.get::<_, String>("data_type")?,
            row.get::<_, String>("is_nullable")?,
            row.get::<_, Option<String>>("column_default")?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut columns = Vec::new();
    for row in rows {
        let (name, data_type, is_nullable, default_value) = row.map_err(|e| e.to_string())?;
        columns.push(ColumnInfo {
            name,
            data_type,
            nullable: is_nullable == "YES",
            default_value,
            is_primary_key: false,
        });
    }

    Ok(TableInfo {
        name: table.to_string(),
        schema: Some("main".to_string()),
        columns,
    })
}

pub fn execute_query(conn: &Connection, sql: &str) -> Result<QueryResult, String> {
    let trimmed = sql.trim().to_uppercase();
    let is_select = trimmed.starts_with("SELECT")
        || trimmed.starts_with("SHOW")
        || trimmed.starts_with("DESCRIBE")
        || trimmed.starts_with("EXPLAIN")
        || trimmed.starts_with("PRAGMA");

    if is_select {
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        let column_names: Vec<String> = rows
            .as_ref()
            .map(|stmt| stmt.column_names())
            .unwrap_or_default();
        let column_count = column_names.len();

        let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let mut values = Vec::with_capacity(column_count);
            for i in 0..column_count {
                let val: Value = row.get(i).map_err(|e| e.to_string())?;
                values.push(value_to_json(val));
            }
            result_rows.push(values);
        }

        Ok(QueryResult {
            columns: column_names,
            rows: result_rows,
            affected_rows: None,
        })
    } else {
        let affected = conn.execute(sql, []).map_err(|e| e.to_string())?;
        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(affected as u64),
        })
    }
}

pub fn execute_raw(conn: &Connection, sql: &str) -> Result<u64, String> {
    let affected = conn.execute(sql, []).map_err(|e| e.to_string())?;
    Ok(affected as u64)
}

pub fn get_table_ddl(
    conn: &Connection,
    _database: &str,
    table: &str,
) -> Result<String, String> {
    let sql = "SELECT sql FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map([table], |row| {
        row.get::<_, Option<String>>(0)
    }).map_err(|e| e.to_string())?;

    if let Some(ddl) = rows.next() {
        let ddl = ddl.map_err(|e| e.to_string())?;
        Ok(ddl.unwrap_or_default())
    } else {
        Ok("".to_string())
    }
}

fn value_to_json(value: Value) -> serde_json::Value {
    use serde_json::Value as JsonValue;

    match value {
        Value::Null => JsonValue::Null,
        Value::Boolean(b) => JsonValue::Bool(b),
        Value::TinyInt(n) => JsonValue::Number(n.into()),
        Value::SmallInt(n) => JsonValue::Number(n.into()),
        Value::Int(n) => JsonValue::Number(n.into()),
        Value::BigInt(n) => JsonValue::Number(n.into()),
        Value::HugeInt(n) => JsonValue::String(n.to_string()),
        Value::UTinyInt(n) => JsonValue::Number(n.into()),
        Value::USmallInt(n) => JsonValue::Number(n.into()),
        Value::UInt(n) => JsonValue::Number(n.into()),
        Value::UBigInt(n) => JsonValue::Number(n.into()),
        Value::Float(n) => JsonValue::Number(serde_json::Number::from_f64(n as f64).unwrap_or(0.into())),
        Value::Double(n) => JsonValue::Number(serde_json::Number::from_f64(n).unwrap_or(0.into())),
        Value::Decimal(n) => JsonValue::String(n.to_string()),
        Value::Timestamp(_, ts) => JsonValue::String(ts.to_string()),
        Value::Text(s) => JsonValue::String(s),
        Value::Blob(b) => JsonValue::String(format!("<BLOB {} bytes>", b.len())),
        Value::Date32(d) => JsonValue::String(d.to_string()),
        Value::Time64(_, t) => JsonValue::String(t.to_string()),
        Value::Interval { months, days, nanos } => JsonValue::String(format!("{} months, {} days, {} nanos", months, days, nanos)),
        Value::List(_) | Value::Struct(_) | Value::Map(_) | Value::Union(_) | Value::Enum(_) | Value::Array(_) => {
            JsonValue::String(format!("{:?}", value))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ConnectionConfig;

    fn test_config() -> ConnectionConfig {
        ConnectionConfig {
            id: "test".to_string(),
            name: "test".to_string(),
            conn_type: "duckdb".to_string(),
            host: None,
            port: None,
            username: None,
            password: None,
            database: None,
            ssl_mode: None,
            file_path: Some(":memory:".to_string()),
            ssh_enabled: None,
            ssh_host: None,
            ssh_port: None,
            ssh_user: None,
            ssh_private_key: None,
        }
    }

    #[test]
    fn test_duckdb_connect_and_query() {
        let config = test_config();
        let conn = connect(&config).unwrap();

        conn.execute(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR, tags VARCHAR[])",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO users VALUES (1, 'Alice', ['admin', 'user'])",
            [],
        ).unwrap();

        let tables = list_tables(&conn, "main").unwrap();
        assert_eq!(tables.len(), 1);
        assert_eq!(tables[0].name, "users");
        assert_eq!(tables[0].columns.len(), 3);

        let schema = get_table_schema(&conn, "main", "users").unwrap();
        assert_eq!(schema.name, "users");
        assert!(schema.columns.iter().any(|c| c.name == "id"));

        let result = execute_query(&conn, "SELECT * FROM users").unwrap();
        assert_eq!(result.columns, vec!["id", "name", "tags"]);
        assert_eq!(result.rows.len(), 1);
        assert_eq!(result.rows[0][0], serde_json::json!(1));
        assert_eq!(result.rows[0][1], serde_json::json!("Alice"));

        let ddl = get_table_ddl(&conn, "main", "users").unwrap();
        assert!(ddl.contains("users"));
    }

    #[test]
    fn test_duckdb_file_connection() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.duckdb");
        let path_str = path.to_str().unwrap().to_string();

        {
            let mut config = test_config();
            config.file_path = Some(path_str.clone());
            let conn = connect(&config).unwrap();
            conn.execute("CREATE TABLE t (id INTEGER)", []).unwrap();
            conn.execute("INSERT INTO t VALUES (42)", []).unwrap();
        }

        {
            let mut config = test_config();
            config.file_path = Some(path_str);
            let conn = connect(&config).unwrap();
            let result = execute_query(&conn, "SELECT * FROM t").unwrap();
            assert_eq!(result.rows.len(), 1);
            assert_eq!(result.rows[0][0], serde_json::json!(42));
        }
    }
}
