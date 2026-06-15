export interface ConnectionConfig {
  id: string;
  name: string;
  type: 'mysql' | 'postgres' | 'sqlite' | 'duckdb';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  sslMode?: string;
  filePath?: string;
  sshEnabled?: boolean;
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshPrivateKey?: string;
}
