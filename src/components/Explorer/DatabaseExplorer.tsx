import React from 'react';
import { ChevronRight, ChevronDown, Table2, Database } from 'lucide-react';
import { useActiveConnectionStore } from '../../stores/activeConnectionStore';

export const DatabaseExplorer: React.FC = () => {
  const {
    databases,
    tables,
    selectedTable,
    activeDatabase,
    selectDatabase,
    isLoading,
    error,
  } = useActiveConnectionStore();

  const [expandedDbs, setExpandedDbs] = React.useState<Set<string>>(new Set());

  const toggleDb = (db: string) => {
    setExpandedDbs((prev) => {
      const next = new Set(prev);
      if (next.has(db)) {
        next.delete(db);
      } else {
        next.add(db);
        selectDatabase(db);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel-bg)]/50">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          Database Explorer
        </h3>
        {activeDatabase && (
          <p className="text-[10px] text-[var(--color-accent)] mt-0.5 truncate">
            Connected: {activeDatabase}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && (
          <div className="px-2 py-3 text-xs text-[var(--color-text-muted)] animate-pulse">
            Loading databases...
          </div>
        )}

        {error && (
          <div className="px-2 py-3 text-xs text-[var(--color-danger)]">
            Error: {error}
          </div>
        )}

        {!isLoading && databases.length === 0 && (
          <div className="px-2 py-3 text-xs text-[var(--color-text-muted)]">
            No databases found
          </div>
        )}

        {databases.map((db) => (
          <div key={db}>
            <button
              onClick={() => toggleDb(db)}
              className="flex items-center gap-1 w-full text-left px-2 py-1.5 rounded hover:bg-[var(--color-panel-bg)] text-sm"
            >
              {expandedDbs.has(db) ? (
                <ChevronDown size={14} className="shrink-0 text-[var(--color-text-muted)]" />
              ) : (
                <ChevronRight size={14} className="shrink-0 text-[var(--color-text-muted)]" />
              )}
              <Database size={14} className="shrink-0 text-[var(--color-accent)]" />
              <span className="truncate">{db}</span>
            </button>

            {expandedDbs.has(db) && (
              <div className="ml-5 space-y-0.5 mt-0.5">
                {tables.length === 0 && (
                  <div className="px-2 py-1 text-xs text-[var(--color-text-muted)]">
                    No tables
                  </div>
                )}
                {tables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => {
                      useActiveConnectionStore.getState().selectTable(table.name);
                    }}
                    className={`flex items-center gap-1 w-full text-left px-2 py-1 rounded text-sm ${
                      selectedTable === table.name
                        ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                        : 'hover:bg-[var(--color-panel-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Table2 size={12} className="shrink-0" />
                    <span className="truncate">{table.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
