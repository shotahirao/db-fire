pub mod commands;
pub mod db;
pub mod models;
pub mod ssh;
pub mod state;

use db::ConnectionManager;
use state::ConnectionsState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ConnectionsState::new())
        .manage(ConnectionManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::create_connection,
            commands::list_connections,
            commands::delete_connection,
            commands::update_connection,
            commands::test_connection,
            commands::connect_db,
            commands::disconnect_db,
            commands::list_databases,
            commands::list_tables,
            commands::get_table_schema,
            commands::execute_query,
            commands::execute_raw,
            commands::get_table_ddl,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
