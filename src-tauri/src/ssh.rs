use async_ssh2_lite::AsyncSession;
use std::net::SocketAddr;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use std::sync::Arc;

pub struct SshTunnel {
    #[allow(dead_code)]
    session: Arc<Mutex<AsyncSession<TcpStream>>>,
    local_port: u16,
    #[allow(dead_code)]
    remote_host: String,
    #[allow(dead_code)]
    remote_port: u16,
}

impl SshTunnel {
    pub async fn connect(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        ssh_private_key: Option<&str>,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<Self, String> {
        let addr: SocketAddr = format!("{}:{}", ssh_host, ssh_port)
            .parse()
            .map_err(|e| format!("Invalid SSH address: {}", e))?;

        let stream = TcpStream::connect(addr)
            .await
            .map_err(|e| format!("SSH TCP connect failed: {}", e))?;

        let mut session = AsyncSession::new(stream, None)
            .map_err(|e| format!("SSH session creation failed: {}", e))?;

        session
            .handshake()
            .await
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        if let Some(key_path) = ssh_private_key {
            session
                .userauth_pubkey_file(ssh_user, None, std::path::Path::new(key_path), None)
                .await
                .map_err(|e| format!("SSH key auth failed: {}", e))?;
        } else {
            return Err("SSH password auth not implemented, please provide a private key".to_string());
        }

        // Find an available local port
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Failed to bind local port: {}", e))?;
        let local_port = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?
            .port();

        // Drop the listener, we'll use the port directly in connection strings
        drop(listener);

        let session = Arc::new(Mutex::new(session));
        let session_clone = session.clone();
        let remote_host_clone = remote_host.to_string();

        // Spawn background task to accept tunnel connections
        tokio::spawn(async move {
            let listener = match TcpListener::bind(format!("127.0.0.1:{}", local_port)).await {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("SSH tunnel listener failed: {}", e);
                    return;
                }
            };

            loop {
                let (mut local_stream, _) = match listener.accept().await {
                    Ok(r) => r,
                    Err(e) => {
                        eprintln!("SSH tunnel accept failed: {}", e);
                        continue;
                    }
                };

                let session = session_clone.clone();
                let remote_host = remote_host_clone.clone();

                tokio::spawn(async move {
                    let session = session.lock().await;
                    let channel = match session
                        .channel_direct_tcpip(&remote_host, remote_port, None)
                        .await
                    {
                        Ok(c) => c,
                        Err(e) => {
                            eprintln!("SSH channel creation failed: {}", e);
                            return;
                        }
                    };
                    drop(session);

                    let mut channel_stream = channel.stream(0);
                    let _ = tokio::io::copy_bidirectional(&mut local_stream, &mut channel_stream).await;
                });
            }
        });

        Ok(Self {
            session,
            local_port,
            remote_host: remote_host.to_string(),
            remote_port,
        })
    }

    pub fn local_port(&self) -> u16 {
        self.local_port
    }
}
