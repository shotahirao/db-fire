import React, { useEffect, useState } from 'react';
import { useActiveConnectionStore, TableInfo } from '../../stores/activeConnectionStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { DataGrid } from '../DataGrid/DataGrid';
import { ImportDialog } from '../Import/ImportDialog';
import { exportToCSV, exportToJSON, exportToSQLInsert, DbType } from '../../lib/export';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileCode,
  Table2,
  Columns,
  Download,
  Upload,
} from 'lucide-react';

interface TableTabPanelProps {
  tableName: string;
}

export const TableTabPanel: React.FC<TableTabPanelProps> = ({ tableName }) => {
  const { activeConnectionId, activeDatabase } = useActiveConnectionStore();
  const { connections } = useConnectionStore();
  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const dbType: DbType = (activeConnection?.type as DbType) || 'mysql';

  const [schema, setSchema] = useState<TableInfo | null>(null);
  const [tableData, setTableData] = useState<{
    columns: string[];
    rows: (string | number | boolean | null)[][];
  } | null>(null);
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(100);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [ddl, setDdl] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'data' | 'structure' | 'ddl'>('data');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jumpPage, setJumpPage] = useState('');
  const [exportPreset, setExportPreset] = useState('csv-current');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const fetchSchema = async () => {
    if (!activeConnectionId || !activeDatabase || !tableName) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<TableInfo>('get_table_schema', {
        id: activeConnectionId,
        database: activeDatabase,
        table: tableName,
      });
      setSchema(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    if (!activeConnectionId || !activeDatabase || !tableName) return;
    setIsLoading(true);
    setError(null);
    try {
      let sql = `SELECT * FROM ${tableName}`;
      if (filter.trim()) {
        sql += ` WHERE ${filter}`;
      }
      sql += ` LIMIT ${limit} OFFSET ${offset}`;

      const result = await invoke<{ columns: string[]; rows: any[][] }>('execute_query', {
        id: activeConnectionId,
        sql,
      });

      setTableData({
        columns: result.columns,
        rows: result.rows.map((row) =>
          row.map((cell) => {
            if (cell === null || typeof cell === 'undefined') return null;
            if (typeof cell === 'object') return JSON.stringify(cell);
            return cell as string | number | boolean;
          })
        ),
      });

      try {
        let countSql = `SELECT COUNT(*) AS cnt FROM ${tableName}`;
        if (filter.trim()) {
          countSql += ` WHERE ${filter}`;
        }
        const countResult = await invoke<{ columns: string[]; rows: any[][] }>('execute_query', {
          id: activeConnectionId,
          sql: countSql,
        });
        const total = countResult.rows[0]?.[0];
        setTotalCount(typeof total === 'number' ? total : parseInt(String(total), 10) || 0);
      } catch {
        setTotalCount(null);
      }
    } catch (err) {
      setError(String(err));
      setTableData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDdl = async () => {
    if (!activeConnectionId || !activeDatabase || !tableName) return;
    if (ddl) return;
    try {
      const result = await invoke<string>('get_table_ddl', {
        id: activeConnectionId,
        database: activeDatabase,
        table: tableName,
      });
      setDdl(result);
    } catch (err) {
      setDdl(`Error fetching DDL: ${err}`);
    }
  };

  const executeUpdate = async (sql: string) => {
    if (!activeConnectionId) throw new Error('No active connection');
    const affected = await invoke<number>('execute_raw', { id: activeConnectionId, sql });
    await fetchData();
    return affected;
  };

  const importRows = async (sqls: string[]) => {
    if (!activeConnectionId) throw new Error('No active connection');
    for (const sql of sqls) {
      await invoke<number>('execute_raw', { id: activeConnectionId, sql });
    }
    await fetchData();
  };

  const fetchAllData = async (options?: { ignoreFilter?: boolean }) => {
    if (!activeConnectionId || !activeDatabase || !tableName) {
      throw new Error('No table selected');
    }

    let sql = `SELECT * FROM ${tableName}`;
    if (!options?.ignoreFilter && filter.trim()) {
      sql += ` WHERE ${filter}`;
    }

    const result = await invoke<{ columns: string[]; rows: any[][] }>('execute_query', {
      id: activeConnectionId,
      sql,
    });

    return {
      columns: result.columns,
      rows: result.rows.map((row) =>
        row.map((cell) => {
          if (cell === null || typeof cell === 'undefined') return null;
          if (typeof cell === 'object') return JSON.stringify(cell);
          return cell as string | number | boolean;
        })
      ),
    };
  };

  useEffect(() => {
    setSchema(null);
    setTableData(null);
    setDdl(null);
    setFilter('');
    setOffset(0);
    setLimit(100);
    setTotalCount(null);
    setActiveView('data');
    setError(null);
    fetchSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, activeConnectionId, activeDatabase]);

  useEffect(() => {
    if (activeView === 'data') {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, activeConnectionId, activeDatabase, filter, offset, limit, activeView]);

  useEffect(() => {
    if (activeView === 'ddl') {
      fetchDdl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  const handleCellUpdate = async (rowIndex: number, colIndex: number, value: string | null) => {
    if (!tableName || !schema || !tableData) return;

    const column = schema.columns[colIndex];
    if (!column) return;

    const pkColumn = schema.columns.find((c) => c.is_primary_key);
    if (!pkColumn) {
      alert('Cannot edit: table has no primary key');
      return;
    }

    const pkValue = tableData.rows[rowIndex][schema.columns.indexOf(pkColumn)];
    if (pkValue === null) return;

    let newValue = value;
    if (value === 'NULL') newValue = null;

    const sql = `UPDATE ${tableName} SET ${column.name} = ${newValue === null ? 'NULL' : `'${newValue}'`} WHERE ${pkColumn.name} = '${pkValue}'`;
    try {
      await executeUpdate(sql);
    } catch (err) {
      alert(`Update failed: ${err}`);
    }
  };

  const handleExport = async () => {
    if (!tableName || !tableData) return;

    const [format, scope] = exportPreset.split('-') as ['csv' | 'json' | 'sql', 'current' | 'all' | 'filtered'];

    let columns: string[];
    let rows: (string | number | boolean | null)[][];

    if (scope === 'current') {
      columns = tableData.columns;
      rows = tableData.rows;
    } else {
      const data = await fetchAllData({ ignoreFilter: scope === 'all' });
      columns = data.columns;
      rows = data.rows;
    }

    let content: string;
    let extension: string;
    switch (format) {
      case 'csv':
        content = exportToCSV(columns, rows);
        extension = 'csv';
        break;
      case 'json':
        content = exportToJSON(columns, rows);
        extension = 'json';
        break;
      case 'sql':
        content = exportToSQLInsert(tableName, columns, rows, dbType);
        extension = 'sql';
        break;
    }

    const path = await save({
      defaultPath: `export.${extension}`,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (path) await writeTextFile(path, content);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setOffset(0);
  };

  const handleLimitChange = (value: number) => {
    setLimit(value);
    setOffset(0);
  };

  const totalPages = totalCount ? Math.ceil(totalCount / limit) : 1;
  const currentPage = Math.floor(offset / limit) + 1;
  const startRow = totalCount ? Math.min(offset + 1, totalCount) : 0;
  const endRow = totalCount ? Math.min(offset + (tableData?.rows.length || 0), totalCount) : 0;

  const canGoPrev = offset > 0;
  const canGoNext = totalCount !== null && offset + limit < totalCount;

  const handleJump = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const page = parseInt(jumpPage, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        setOffset((page - 1) * limit);
      }
      setJumpPage('');
    }
  };

  if (!activeConnectionId || !activeDatabase) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
        Connect to a database to view tables
      </div>
    );
  }

  if (error && !tableData && !schema) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-danger)] text-sm p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel-bg)]">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveView('data')}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${
              activeView === 'data'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Table2 size={12} />
            Data
          </button>
          <button
            onClick={() => setActiveView('structure')}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${
              activeView === 'structure'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Columns size={12} />
            Structure
          </button>
          <button
            onClick={() => setActiveView('ddl')}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${
              activeView === 'ddl'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <FileCode size={12} />
            DDL
          </button>
        </div>

        {activeView === 'data' && (
          <>
            <div className="flex items-center gap-1 ml-auto">
              <Search size={12} className="text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value)}
                placeholder="WHERE clause (e.g. id > 10)"
                className="px-2 py-1 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-xs focus:outline-none focus:border-[var(--color-accent)] w-48"
              />
            </div>

            <div className="flex items-center gap-1 pl-2 border-l border-[var(--color-border)]">
              <select
                value={exportPreset}
                onChange={(e) => setExportPreset(e.target.value)}
                className="px-2 py-1 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-xs focus:outline-none focus:border-[var(--color-accent)]"
                title="Export format and scope"
              >
                <option value="csv-current">CSV - Current page</option>
                <option value="csv-all">CSV - All rows</option>
                <option value="csv-filtered">CSV - Filtered rows</option>
                <option value="json-current">JSON - Current page</option>
                <option value="json-all">JSON - All rows</option>
                <option value="json-filtered">JSON - Filtered rows</option>
                <option value="sql-all">SQL INSERT - All rows</option>
                <option value="sql-filtered">SQL INSERT - Filtered rows</option>
              </select>
              <button
                onClick={handleExport}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent)] text-[var(--color-main-bg)] hover:bg-[var(--color-accent-hover)]"
                title="Export data to file"
              >
                <Download size={12} />
                Export
              </button>
              <button
                onClick={() => setImportDialogOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30"
                title="Import data from CSV/JSON file"
              >
                <Upload size={12} />
                Import
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'data' && tableData ? (
          <DataGrid
            columns={tableData.columns}
            rows={tableData.rows}
            editable={true}
            onCellUpdate={handleCellUpdate}
          />
        ) : activeView === 'structure' && schema ? (
          <div className="p-4 overflow-auto h-full">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-3 py-2 text-left text-[var(--color-text-muted)]">Column</th>
                  <th className="px-3 py-2 text-left text-[var(--color-text-muted)]">Type</th>
                  <th className="px-3 py-2 text-left text-[var(--color-text-muted)]">Nullable</th>
                  <th className="px-3 py-2 text-left text-[var(--color-text-muted)]">Default</th>
                  <th className="px-3 py-2 text-left text-[var(--color-text-muted)]">Primary Key</th>
                </tr>
              </thead>
              <tbody>
                {schema.columns.map((col) => (
                  <tr key={col.name} className="border-b border-[var(--color-border)] hover:bg-[var(--color-panel-bg)]/50">
                    <td className="px-3 py-2 font-medium">{col.name}</td>
                    <td className="px-3 py-2 text-[var(--color-accent)]">{col.data_type}</td>
                    <td className="px-3 py-2">{col.nullable ? 'YES' : 'NO'}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{col.default_value || '-'}</td>
                    <td className="px-3 py-2">{col.is_primary_key ? 'YES' : 'NO'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeView === 'ddl' && ddl ? (
          <div className="p-4 overflow-auto h-full">
            <pre className="text-sm font-mono text-[var(--color-text)] whitespace-pre-wrap">
              {ddl}
            </pre>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
            {isLoading ? 'Loading...' : 'No data'}
          </div>
        )}
      </div>

      {/* Footer / Pagination */}
      {activeView === 'data' && totalCount !== null && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-panel-bg)] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded px-1 py-0.5 text-xs focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>

          <div className="text-[var(--color-text-muted)]">
            {totalCount > 0 ? (
              <span>Showing {startRow} - {endRow} of {totalCount} rows</span>
            ) : (
              <span>No rows</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setOffset(0)}
              disabled={!canGoPrev}
              className="p-1 rounded hover:bg-[var(--color-main-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
              title="First page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={!canGoPrev}
              className="p-1 rounded hover:bg-[var(--color-main-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="min-w-[60px] text-center text-[var(--color-text)]">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() =>
                setOffset(canGoNext ? offset + limit : offset)
              }
              disabled={!canGoNext}
              className="p-1 rounded hover:bg-[var(--color-main-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setOffset((totalPages - 1) * limit)}
              disabled={!canGoNext}
              className="p-1 rounded hover:bg-[var(--color-main-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
              title="Last page"
            >
              <ChevronsRight size={14} />
            </button>

            <div className="flex items-center gap-1 ml-2 border-l border-[var(--color-border)] pl-2">
              <span className="text-[var(--color-text-muted)]">Go to</span>
              <input
                type="text"
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                onKeyDown={handleJump}
                placeholder="#"
                className="w-10 px-1 py-0.5 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-xs text-center focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>
        </div>
      )}

      {schema && (
        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          tableName={tableName}
          dbType={dbType}
          tableColumns={schema.columns}
          onImport={importRows}
        />
      )}
    </div>
  );
};
