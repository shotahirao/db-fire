import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ConnectionConfig } from '../../types/connection';
import { useConnectionStore } from '../../stores/connectionStore';

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig | null;
}

const emptyConnection = (): ConnectionConfig => ({
  id: crypto.randomUUID(),
  name: '',
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: '',
  password: '',
  database: '',
  sslMode: 'prefer',
  filePath: '',
  sshEnabled: false,
  sshHost: '',
  sshPort: 22,
  sshUser: '',
  sshPrivateKey: '',
});

export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({ open, onOpenChange, connection }) => {
  const [form, setForm] = useState<ConnectionConfig>(emptyConnection());
  const { createConnection, updateConnection } = useConnectionStore();

  useEffect(() => {
    if (connection) {
      setForm(connection);
    } else {
      setForm(emptyConnection());
    }
  }, [connection, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (connection) {
      await updateConnection(form);
    } else {
      await createConnection(form);
    }
    onOpenChange(false);
  };

  const isSqlite = form.type === 'sqlite';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[85vh] overflow-y-auto bg-[var(--color-panel-bg)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">
              {connection ? 'Edit Connection' : 'New Connection'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-[var(--color-main-bg)] text-[var(--color-text-muted)]">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as 'mysql' | 'postgres' | 'sqlite';
                  let port: number | undefined = undefined;
                  if (type === 'mysql') port = 3306;
                  if (type === 'postgres') port = 5432;
                  setForm({ ...form, type, port });
                }}
                className="w-full px-3 py-2 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="mysql">MySQL</option>
                <option value="postgres">PostgreSQL</option>
                <option value="sqlite">SQLite</option>
              </select>
            </div>

            {!isSqlite ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Host</label>
                    <input
                      type="text"
                      value={form.host || ''}
                      onChange={(e) => setForm({ ...form, host: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Port</label>
                    <input
                      type="number"
                      value={form.port || ''}
                      onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Username</label>
                    <input
                      type="text"
                      value={form.username || ''}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Password</label>
                    <input
                      type="password"
                      value={form.password || ''}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Database</label>
                  <input
                    type="text"
                    value={form.database || ''}
                    onChange={(e) => setForm({ ...form, database: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">File Path</label>
                <input
                  type="text"
                  value={form.filePath || ''}
                  onChange={(e) => setForm({ ...form, filePath: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
            )}

            <div className="pt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 rounded text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-main-bg)]">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 rounded text-sm bg-[var(--color-accent)] text-[var(--color-main-bg)] font-medium hover:bg-[var(--color-accent-hover)]"
              >
                {connection ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
