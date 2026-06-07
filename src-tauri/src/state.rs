use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::models::ConnectionConfig;

pub struct ConnectionsState {
    file_name: String,
}

impl ConnectionsState {
    pub fn new() -> Self {
        Self {
            file_name: "connections.json".to_string(),
        }
    }

    fn path(&self, app: &AppHandle) -> Result<PathBuf, String> {
        let app_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?;
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        Ok(app_dir.join(&self.file_name))
    }

    pub fn load(&self, app: &AppHandle) -> Result<Vec<ConnectionConfig>, String> {
        let path = self.path(app)?;
        if !path.exists() {
            return Ok(Vec::new());
        }
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let connections: Vec<ConnectionConfig> =
            serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(connections)
    }

    pub fn save(&self, app: &AppHandle, connections: &[ConnectionConfig]) -> Result<(), String> {
        let path = self.path(app)?;
        let content = serde_json::to_string_pretty(connections).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(())
    }
}

impl Default for ConnectionsState {
    fn default() -> Self {
        Self::new()
    }
}
