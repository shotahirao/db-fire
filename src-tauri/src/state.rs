use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::models::ConnectionConfig;

const KEYRING_SERVICE: &str = "db-fire";

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

    /// 接続に紐づくパスワードをOSキーチェーンから読む。
    fn read_password(id: &str) -> Result<Option<String>, String> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, id).map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(p) => Ok(Some(p)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Failed to read password from keychain: {}", e)),
        }
    }

    /// 接続に紐づくパスワードをOSキーチェーンへ書く（Noneなら削除）。
    fn write_password(id: &str, password: Option<&str>) -> Result<(), String> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, id).map_err(|e| e.to_string())?;
        match password {
            Some(p) if !p.is_empty() => entry
                .set_password(p)
                .map_err(|e| format!("Failed to store password in keychain: {}", e)),
            _ => match entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                Err(e) => Err(format!("Failed to clear password from keychain: {}", e)),
            },
        }
    }

    fn delete_password(id: &str) -> Result<(), String> {
        Self::write_password(id, None)
    }

    pub fn load(&self, app: &AppHandle) -> Result<Vec<ConnectionConfig>, String> {
        let path = self.path(app)?;
        if !path.exists() {
            return Ok(Vec::new());
        }
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let mut connections: Vec<ConnectionConfig> =
            serde_json::from_str(&content).map_err(|e| e.to_string())?;

        // 旧バージョンのJSONに平文パスワードが残っていればキーチェーンへ移行する
        let mut needs_migration = false;
        for conn in &mut connections {
            if let Some(plain) = conn.password.take() {
                if !plain.is_empty() {
                    Self::write_password(&conn.id, Some(&plain))?;
                    needs_migration = true;
                    conn.password = Some(plain);
                    continue;
                }
            }
            // キーチェーンから補完
            conn.password = Self::read_password(&conn.id)?;
        }
        if needs_migration {
            self.write_file(app, &connections)?;
        }
        Ok(connections)
    }

    /// パスワードを除いたJSONをディスクへ書く。
    fn write_file(&self, app: &AppHandle, connections: &[ConnectionConfig]) -> Result<(), String> {
        let path = self.path(app)?;
        let sanitized: Vec<ConnectionConfig> = connections
            .iter()
            .map(|c| {
                let mut c = c.clone();
                c.password = None;
                c
            })
            .collect();
        let content = serde_json::to_string_pretty(&sanitized).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save(&self, app: &AppHandle, connections: &[ConnectionConfig]) -> Result<(), String> {
        // パスワードはキーチェーンに、それ以外はJSONに保存する
        for conn in connections {
            Self::write_password(&conn.id, conn.password.as_deref())?;
        }
        self.write_file(app, connections)
    }

    /// 接続削除時にキーチェーンのパスワードも消す。
    pub fn forget_password(id: &str) -> Result<(), String> {
        Self::delete_password(id)
    }
}

impl Default for ConnectionsState {
    fn default() -> Self {
        Self::new()
    }
}
