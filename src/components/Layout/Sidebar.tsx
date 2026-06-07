import React, { useState, useEffect } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useActiveConnectionStore } from '../../stores/activeConnectionStore';
import { Plus, Database, Trash2, Edit, Plug, Unplug } from 'lucide-react';
import { ConnectionConfig } from '../../types/connection';
import { ConnectionDialog } from '../Connection/ConnectionDialog';
import { DatabaseExplorer } from '../Explorer/DatabaseExplorer';

export const Sidebar: React.FC = () => {
  const { connections, fetchConnections, deleteConnection } = useConnectionStore();
  const { activeConnectionId, connect, disconnect, isLoading, error } = useActiveConnectionStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleEdit = (conn: ConnectionConfig) => {
    setEditingConnection(conn);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingConnection(null);
    setDialogOpen(true);
  };

  const handleConnect = (e: React.MouseEvent, conn: ConnectionConfig) => {
    e.stopPropagation();
    connect(conn.id);
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    disconnect();
  };

  return (
    <div className="w-64 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar-bg)]">
      <div className="p-3 flex items-center justify-between border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Connections</h2>
        <button onClick={handleAdd} className="p-1 rounded hover:bg-[var(--color-panel-bg)] text-[var(--color-accent)]">
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
        {/* Connection List */}
        <div className="p-2 space-y-1 shrink-0">
          {connections.map((conn) => (
            <div
              key={conn.id}
              onClick={() => {
                if (activeConnectionId !== conn.id) {
                  connect(conn.id);
                }
              }}
              className={`group flex items-center justify-between p-2 rounded cursor-pointer ${
                activeConnectionId === conn.id
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                  : 'hover:bg-[var(--color-panel-bg)]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Database size={16} className="shrink-0" />
                <span className="text-sm truncate">{conn.name}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                {activeConnectionId === conn.id ? (
                  <button onClick={handleDisconnect} className="p-1 rounded hover:bg-[var(--color-main-bg)] text-[var(--color-danger)]" title="Disconnect">
                    <Unplug size={14} />
                  </button>
                ) : (
                  <button onClick={(e) => handleConnect(e, conn)} className="p-1 rounded hover:bg-[var(--color-main-bg)] text-[var(--color-success)]" title="Connect">
                    <Plug size={14} />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleEdit(conn); }} className="p-1 rounded hover:bg-[var(--color-main-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  <Edit size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }} className="p-1 rounded hover:bg-[var(--color-main-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] animate-pulse shrink-0">
            Connecting...
          </div>
        )}

        {error && (
          <div className="px-3 py-2 text-xs text-[var(--color-danger)] shrink-0">
            Error: {error}
          </div>
        )}

        {/* Database Explorer */}
        {activeConnectionId && (
          <div className="flex-1 flex flex-col min-h-0 border-t border-[var(--color-border)] mt-2 pt-1">
            <DatabaseExplorer />
          </div>
        )}
      </div>

      <ConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        connection={editingConnection}
      />
    </div>
  );
};
