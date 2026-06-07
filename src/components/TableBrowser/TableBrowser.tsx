import React, { useState } from 'react';
import { useActiveConnectionStore } from '../../stores/activeConnectionStore';
import { DataGrid } from '../DataGrid/DataGrid';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileCode, Table2, Columns, FileJson } from 'lucide-react';

interface TableBrowserProps {
  onNewQuery?: () => void;
}

export const TableBrowser: React.FC<TableBrowserProps> = ({ onNewQuery }) => {
  const {
    tableData,
    selectedTable,
    selectedTableSchema,
    tableFilter,
    tableOffset,
    tableLimit,
    tableTotalCount,
    tableDdl,
    isLoading,
    setTableFilter,
    setTableOffset,
    setTableLimit,
    fetchTableDdl,
    executeUpdate,
  } = useActiveConnectionStore();

  const [activeView, setActiveView] = useState<'data' | 'structure' | 'ddl'>('data');
  const [jumpPage, setJumpPage] = useState('');

  const handleCellUpdate = async (rowIndex: number, colIndex: number, value: string | null) => {
    if (!selectedTable || !selectedTableSchema || !tableData) return;

    const column = selectedTableSchema.columns[colIndex];
    if (!column) return;

    const pkColumn = selectedTableSchema.columns.find((c) => c.is_primary_key);
    if (!pkColumn) {
      alert('Cannot edit: table has no primary key');
      return;
    }

    const pkValue = tableData.rows[rowIndex][selectedTableSchema.columns.indexOf(pkColumn)];
    if (pkValue === null) return;

    let newValue = value;
    if (value === 'NULL') newValue = null;

    const sql = `UPDATE ${selectedTable} SET ${column.name} = ${newValue === null ? 'NULL' : `'${newValue}'`} WHERE ${pkColumn.name} = '${pkValue}'`;
    try {
      await executeUpdate(sql);
    } catch (err) {
      alert(`Update failed: ${err}`);
    }
  };

  const totalPages = tableTotalCount ? Math.ceil(tableTotalCount / tableLimit) : 1;
  const currentPage = Math.floor(tableOffset / tableLimit) + 1;
  const startRow = tableTotalCount ? Math.min(tableOffset + 1, tableTotalCount) : 0;
  const endRow = tableTotalCount ? Math.min(tableOffset + (tableData?.rows.length || 0), tableTotalCount) : 0;

  const canGoPrev = tableOffset > 0;
  const canGoNext = tableTotalCount !== null && tableOffset + tableLimit < tableTotalCount;

  const handleJump = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const page = parseInt(jumpPage, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        setTableOffset((page - 1) * tableLimit);
      }
      setJumpPage('');
    }
  };

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
            onClick={() => { setActiveView('ddl'); fetchTableDdl(); }}
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

        {activeView === 'data' && selectedTable && (
          <>
            <div className="flex items-center gap-1 ml-auto">
              <Search size={12} className="text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="WHERE clause (e.g. id > 10)"
                className="px-2 py-1 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-xs focus:outline-none focus:border-[var(--color-accent)] w-48"
              />
            </div>
          </>
        )}

        {onNewQuery && (
          <button
            onClick={onNewQuery}
            className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 ml-2"
          >
            <FileJson size={12} />
            New Query
          </button>
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
        ) : activeView === 'structure' && selectedTableSchema ? (
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
                {selectedTableSchema.columns.map((col) => (
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
        ) : activeView === 'ddl' && tableDdl ? (
          <div className="p-4 overflow-auto h-full">
            <pre className="text-sm font-mono text-[var(--color-text)] whitespace-pre-wrap">
              {tableDdl}
            </pre>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
            {isLoading ? 'Loading...' : 'Select a table to view'}
          </div>
        )}
      </div>

      {/* Footer / Pagination */}
      {activeView === 'data' && selectedTable && tableTotalCount !== null && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-panel-bg)] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">Rows per page:</span>
            <select
              value={tableLimit}
              onChange={(e) => setTableLimit(Number(e.target.value))}
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
            {tableTotalCount > 0 ? (
              <span>Showing {startRow} - {endRow} of {tableTotalCount} rows</span>
            ) : (
              <span>No rows</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setTableOffset(0)}
              disabled={!canGoPrev}
              className="p-1 rounded hover:bg-[var(--color-main-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
              title="First page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setTableOffset(Math.max(0, tableOffset - tableLimit))}
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
                setTableOffset(
                  canGoNext ? tableOffset + tableLimit : tableOffset
                )
              }
              disabled={!canGoNext}
              className="p-1 rounded hover:bg-[var(--color-main-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() =>
                setTableOffset((totalPages - 1) * tableLimit)
              }
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
    </div>
  );
};
