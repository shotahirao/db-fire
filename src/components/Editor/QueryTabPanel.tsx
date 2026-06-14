import React, { useState } from 'react';
import { format } from 'sql-formatter';
import { useActiveConnectionStore } from '../../stores/activeConnectionStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useWorkspaceStore, QueryResults, QueryTab } from '../../stores/workspaceStore';
import { MonacoEditor } from './MonacoEditor';
import { DataGrid } from '../DataGrid/DataGrid';
import { invoke } from '@tauri-apps/api/core';
import { Play, Loader2, Database, Terminal, AlignLeft } from 'lucide-react';

interface QueryTabPanelProps {
  tabId: string;
}

const getFormatterLanguage = (type?: string) => {
  switch (type) {
    case 'mysql':
      return 'mysql';
    case 'postgres':
      return 'postgresql';
    case 'sqlite':
      return 'sqlite';
    default:
      return 'sql';
  }
};

export const QueryTabPanel: React.FC<QueryTabPanelProps> = ({ tabId }) => {
  const { activeConnectionId, tables, selectedTableSchema } = useActiveConnectionStore();
  const { connections } = useConnectionStore();
  const {
    tabs,
    updateQueryTabContent,
    setQueryTabResults,
    setQueryTabExecuting,
    setQueryTabMeta,
    addToHistory,
  } = useWorkspaceStore();

  const activeTab = tabs.find((t): t is QueryTab => t.id === tabId && t.type === 'query');
  const [resultPaneTab, setResultPaneTab] = useState<'results' | 'query'>('results');

  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const dbType = activeConnection?.type;

  const schemaTables = React.useMemo(() => {
    const schema: { name: string; columns: string[] }[] = [];
    tables.forEach((t) => {
      schema.push({
        name: t.name,
        columns: t.columns.map((c) => c.name),
      });
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

    setQueryTabExecuting(tabId, true);
    setQueryTabResults(tabId, null);
    setResultPaneTab('results');
    const startTime = Date.now();

    try {
      const result = await invoke<{
        columns: string[];
        rows: any[][];
        affected_rows?: number;
      }>('execute_query', {
        id: activeConnectionId,
        sql,
      });

      const elapsed = Date.now() - startTime;
      const affectedRows = result.affected_rows;

      if (result.columns.length > 0) {
        const queryResults: QueryResults = {
          columns: result.columns,
          rows: result.rows.map((row) =>
            row.map((cell) => {
              if (cell === null || typeof cell === 'undefined') return null;
              if (typeof cell === 'object') return JSON.stringify(cell);
              return cell as string | number | boolean;
            })
          ),
        };
        setQueryTabResults(tabId, queryResults);
      } else {
        setQueryTabResults(tabId, {
          columns: ['Result'],
          rows: [[`Affected rows: ${affectedRows || 0}`]],
          affectedRows,
        });
      }

      setQueryTabMeta(tabId, {
        lastQuery: sql,
        lastExecutionTime: elapsed,
        lastAffectedRows: affectedRows,
      });
      addToHistory(sql);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      setQueryTabResults(tabId, {
        columns: ['Error'],
        rows: [[String(err)]],
      });
      setQueryTabMeta(tabId, {
        lastQuery: sql,
        lastExecutionTime: elapsed,
      });
    } finally {
      setQueryTabExecuting(tabId, false);
    }
  };

  const handleFormat = () => {
    if (!activeTab || !activeTab.content.trim()) return;
    try {
      const formatted = format(activeTab.content, {
        language: getFormatterLanguage(dbType),
        keywordCase: 'upper',
        indentStyle: 'standard',
        tabWidth: 2,
        linesBetweenQueries: 2,
      });
      updateQueryTabContent(tabId, formatted.trimEnd());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('SQL format error:', err);
    }
  };

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
        Tab not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel-bg)]">
        <button
          onClick={handleExecute}
          disabled={!activeConnectionId || activeTab.isExecuting}
          className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${
            activeConnectionId && !activeTab.isExecuting
              ? 'bg-[var(--color-success)] text-[var(--color-main-bg)] hover:opacity-90'
              : 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
          }`}
        >
          {activeTab.isExecuting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Play size={12} />
          )}
          {activeTab.isExecuting ? 'Running...' : 'Run (⌘+Enter)'}
        </button>

        <button
          onClick={handleFormat}
          disabled={!activeTab.content.trim()}
          title="Format SQL (Shift+Alt+F)"
          className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${
            activeTab.content.trim()
              ? 'bg-[var(--color-accent)] text-[var(--color-main-bg)] hover:opacity-90'
              : 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
          }`}
        >
          <AlignLeft size={12} />
          Format
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
            value={activeTab.content}
            onChange={(value) => updateQueryTabContent(tabId, value)}
            onExecute={handleExecute}
            onFormat={handleFormat}
            schemaTables={schemaTables}
          />
        </div>

        {/* Results */}
        {activeTab.results && (
          <div className="flex-1 min-h-[150px] border-t border-[var(--color-border)] overflow-hidden flex flex-col">
            {/* Result pane tabs */}
            <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-panel-bg)]">
              <button
                onClick={() => setResultPaneTab('results')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs border-r border-[var(--color-border)] ${
                  resultPaneTab === 'results'
                    ? 'bg-[var(--color-main-bg)] text-[var(--color-text)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Database size={12} />
                Results
              </button>
              <button
                onClick={() => setResultPaneTab('query')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs border-r border-[var(--color-border)] ${
                  resultPaneTab === 'query'
                    ? 'bg-[var(--color-main-bg)] text-[var(--color-text)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Terminal size={12} />
                Query
              </button>
            </div>

            {/* Pane content */}
            <div className="flex-1 overflow-hidden">
              {resultPaneTab === 'results' ? (
                activeTab.results.columns[0] === 'Error' ? (
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
                )
              ) : (
                <div className="p-3 h-full overflow-auto">
                  <div className="text-xs text-[var(--color-text-muted)] mb-2 flex items-center gap-4">
                    <span>
                      {activeTab.lastExecutionTime !== undefined && (
                        <>Execution time: <strong className="text-[var(--color-text)]">{activeTab.lastExecutionTime} ms</strong></>
                      )}
                    </span>
                    {activeTab.lastAffectedRows !== undefined && (
                      <span>
                        Affected rows: <strong className="text-[var(--color-text)]">{activeTab.lastAffectedRows}</strong>
                      </span>
                    )}
                  </div>
                  <pre className="text-sm font-mono text-[var(--color-text)] whitespace-pre-wrap bg-[var(--color-panel-bg)] p-2 rounded border border-[var(--color-border)]">
                    {activeTab.lastQuery || activeTab.content}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
