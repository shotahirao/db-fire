import React from 'react';
import { useActiveConnectionStore } from '../../stores/activeConnectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { MonacoEditor } from './MonacoEditor';
import { DataGrid } from '../DataGrid/DataGrid';
import { invoke } from '@tauri-apps/api/core';
import { Play, Plus, X, Loader2, ArrowLeft } from 'lucide-react';

interface SQLEditorPanelProps {
  onClose?: () => void;
}

export const SQLEditorPanel: React.FC<SQLEditorPanelProps> = ({ onClose }) => {
  const { activeConnectionId, tables, selectedTableSchema } = useActiveConnectionStore();
  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    updateTabContent,
    setTabResults,
    setTabExecuting,
    addToHistory,
  } = useEditorStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const schemaTables = React.useMemo(() => {
    const schema: { name: string; columns: string[] }[] = [];
    tables.forEach((t) => {
      if (t.columns && t.columns.length > 0) {
        schema.push({
          name: t.name,
          columns: t.columns.map((c) => c.name),
        });
      }
    });
    if (selectedTableSchema && !schema.find((s) => s.name === selectedTableSchema.name)) {
      schema.push({
        name: selectedTableSchema.name,
        columns: selectedTableSchema.columns.map((c) => c.name),
      });
    }
    return schema;
  }, [tables, selectedTableSchema]);

  const handleExecute = async () => {
    if (!activeConnectionId || !activeTab || activeTab.isExecuting) return;

    const sql = activeTab.content.trim();
    if (!sql) return;

    setTabExecuting(activeTab.id, true);
    setTabResults(activeTab.id, null);

    try {
      const result = await invoke<{
        columns: string[];
        rows: any[][];
        affected_rows?: number;
      }>('execute_query', {
        id: activeConnectionId,
        sql,
      });

      if (result.columns.length > 0) {
        setTabResults(activeTab.id, {
          columns: result.columns,
          rows: result.rows.map((row) =>
            row.map((cell) => {
              if (cell === null || typeof cell === 'undefined') return null;
              if (typeof cell === 'object') return JSON.stringify(cell);
              return cell as string | number | boolean;
            })
          ),
          affectedRows: undefined,
        });
      } else {
        setTabResults(activeTab.id, {
          columns: ['Result'],
          rows: [[`Affected rows: ${result.affected_rows || 0}`]],
          affectedRows: result.affected_rows,
        });
      }

      addToHistory(sql);
    } catch (err) {
      setTabResults(activeTab.id, {
        columns: ['Error'],
        rows: [[String(err)]],
        affectedRows: undefined,
      });
    } finally {
      setTabExecuting(activeTab.id, false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-panel-bg)]">
        <div className="flex-1 flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs border-r border-[var(--color-border)] min-w-fit ${
                activeTabId === tab.id
                  ? 'bg-[var(--color-main-bg)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <X
                  size={12}
                  className="hover:text-[var(--color-danger)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                />
              )}
            </button>
          ))}
        </div>
        <button
          onClick={addTab}
          className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel-bg)]">
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-main-bg)]"
          >
            <ArrowLeft size={12} />
            Back
          </button>
        )}

        <button
          onClick={handleExecute}
          disabled={!activeConnectionId || activeTab?.isExecuting}
          className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${
            activeConnectionId && !activeTab?.isExecuting
              ? 'bg-[var(--color-success)] text-[var(--color-main-bg)] hover:opacity-90'
              : 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
          }`}
        >
          {activeTab?.isExecuting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Play size={12} />
          )}
          {activeTab?.isExecuting ? 'Running...' : 'Run (⌘+Enter)'}
        </button>

        {!activeConnectionId && (
          <span className="text-xs text-[var(--color-danger)]">
            Connect to a database to execute queries
          </span>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-[150px]">
          <MonacoEditor
            value={activeTab?.content || ''}
            onChange={(value) => updateTabContent(activeTab?.id || '', value)}
            onExecute={handleExecute}
            schemaTables={schemaTables}
          />
        </div>

        {/* Results */}
        {activeTab?.results && (
          <div className="flex-1 min-h-[150px] border-t border-[var(--color-border)] overflow-hidden">
            {activeTab.results.columns[0] === 'Error' ? (
              <div className="p-3 text-sm text-[var(--color-danger)] font-mono whitespace-pre-wrap overflow-auto h-full">
                {String(activeTab.results.rows[0]?.[0] || 'Unknown error')}
              </div>
            ) : activeTab.results.columns[0] === 'Result' ? (
              <div className="p-3 text-sm text-[var(--color-success)]">
                {String(activeTab.results.rows[0]?.[0] || '')}
              </div>
            ) : (
              <DataGrid
                columns={activeTab.results.columns}
                rows={activeTab.results.rows}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
