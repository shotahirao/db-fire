use tauri::{AppHandle, Manager};
use crate::db::{ConnectionManager, TableInfo, QueryResult};
use crate::models::ConnectionConfig;
use crate::state::ConnectionsState;

#[tauri::command]
pub async fn create_connection(
    app: AppHandle,
    config: ConnectionConfig,
) -> Result<ConnectionConfig, String> {
    let state = app.state::<ConnectionsState>();
    let mut connections = state.load(&app)?;

    if connections.iter().any(|c| c.id == config.id) {
        return Err("Connection with this ID already exists".to_string());
    }

    connections.push(config.clone());
    state.save(&app, &connections)?;
    Ok(config)
}

#[tauri::command]
pub async fn list_connections(app: AppHandle) -> Result<Vec<ConnectionConfig>, String> {
    let state = app.state::<ConnectionsState>();
    state.load(&app)
}

#[tauri::command]
pub async fn delete_connection(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<ConnectionsState>();
    let mut connections = state.load(&app)?;
    connections.retain(|c| c.id != id);
    state.save(&app, &connections)?;
    Ok(())
}

#[tauri::command]
pub async fn update_connection(
    app: AppHandle,
    config: ConnectionConfig,
) -> Result<ConnectionConfig, String> {
    let state = app.state::<ConnectionsState>();
    let mut connections = state.load(&app)?;

    let pos = connections
        .iter()
        .position(|c| c.id == config.id)
        .ok_or("Connection not found")?;
    connections[pos] = config.clone();
    state.save(&app, &connections)?;
    Ok(config)
}

#[tauri::command]
pub async fn test_connection(
    app: AppHandle,
    config: ConnectionConfig,
) -> Result<(), String> {
    let manager = app.state::<ConnectionManager>();
    manager.test_connection(&config).await
}

#[tauri::command]
pub async fn connect_db(
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    let state = app.state::<ConnectionsState>();
    let connections = state.load(&app)?;
    let config = connections
        .iter()
        .find(|c| c.id == id)
        .ok_or("Connection not found")?;

    let manager = app.state::<ConnectionManager>();
    manager.connect(config).await
}

#[tauri::command]
pub async fn disconnect_db(
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    let manager = app.state::<ConnectionManager>();
    manager.disconnect(&id).await
}

#[tauri::command]
pub async fn list_databases(
    app: AppHandle,
    id: String,
) -> Result<Vec<String>, String> {
    let manager = app.state::<ConnectionManager>();
    manager.list_databases(&id).await
}

#[tauri::command]
pub async fn list_tables(
    app: AppHandle,
    id: String,
    database: String,
) -> Result<Vec<TableInfo>, String> {
    let manager = app.state::<ConnectionManager>();
    manager.list_tables(&id, &database).await
}

#[tauri::command]
pub async fn get_table_schema(
    app: AppHandle,
    id: String,
    database: String,
    table: String,
) -> Result<TableInfo, String> {
    let manager = app.state::<ConnectionManager>();
    manager.get_table_schema(&id, &database, &table).await
}

#[tauri::command]
pub async fn execute_query(
    app: AppHandle,
    id: String,
    sql: String,
) -> Result<QueryResult, String> {
    let manager = app.state::<ConnectionManager>();
    manager.execute_query(&id, &sql).await
}

#[tauri::command]
pub async fn execute_raw(
    app: AppHandle,
    id: String,
    sql: String,
) -> Result<u64, String> {
    let manager = app.state::<ConnectionManager>();
    manager.execute_raw(&id, &sql).await
}

#[tauri::command]
pub async fn get_table_ddl(
    app: AppHandle,
    id: String,
    database: String,
    table: String,
) -> Result<String, String> {
    let manager = app.state::<ConnectionManager>();
    manager.get_table_ddl(&id, &database, &table).await
}
