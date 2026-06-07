import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import { exportToCSV, exportToJSON } from '../../lib/export';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { FileJson, FileSpreadsheet, ArrowUp, ArrowDown } from 'lucide-react';

interface DataGridProps {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  editable?: boolean;
  onCellUpdate?: (rowIndex: number, colIndex: number, value: string | null) => void;
}

export const DataGrid: React.FC<DataGridProps> = ({
  columns,
  rows,
  editable = false,
  onCellUpdate,
}) => {
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const tableColumns = React.useMemo(
    () =>
      columns.map((col, colIndex) => ({
        accessorKey: col,
        header: col,
        enableSorting: true,
        cell: ({ row, getValue }: any) => {
          const rowIndex = row.index;
          const isEditing =
            editingCell?.row === rowIndex && editingCell?.col === colIndex;
          const value = getValue();

          // Find original row index for updates
          const originalRowIndex = rows.findIndex(
            (r) => columns.every((c, i) => r[i] === row.original[c])
          );

          if (isEditing && editable) {
            return (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onCellUpdate?.(originalRowIndex >= 0 ? originalRowIndex : rowIndex, colIndex, editValue || null);
                    setEditingCell(null);
                  } else if (e.key === 'Escape') {
                    setEditingCell(null);
                  }
                }}
                onBlur={() => {
                  onCellUpdate?.(originalRowIndex >= 0 ? originalRowIndex : rowIndex, colIndex, editValue || null);
                  setEditingCell(null);
                }}
                autoFocus
                className="w-full px-1 py-0.5 bg-[var(--color-main-bg)] border border-[var(--color-accent)] rounded text-sm focus:outline-none"
              />
            );
          }

          const displayValue =
            value === null || value === undefined ? (
              <span className="text-[var(--color-text-muted)] italic">NULL</span>
            ) : (
              String(value)
            );

          return (
            <span
              onDoubleClick={() => {
                if (!editable) return;
                setEditingCell({ row: rowIndex, col: colIndex });
                setEditValue(value === null ? 'NULL' : String(value));
              }}
              className={editable ? 'cursor-pointer hover:bg-[var(--color-accent)]/10 px-1 py-0.5 rounded' : ''}
            >
              {displayValue}
            </span>
          );
        },
      })),
    [columns, rows, editingCell, editValue, editable, onCellUpdate]
  );

  const tableData = React.useMemo(
    () =>
      rows.map((row) => {
        const obj: Record<string, any> = {};
        row.forEach((cell, i) => {
          obj[columns[i]] = cell;
        });
        return obj;
      }),
    [rows, columns]
  );

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-[var(--color-panel-bg)] z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--color-border)]">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-semibold text-[var(--color-text-muted)] whitespace-nowrap select-none"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && (
                        <ArrowUp size={12} className="text-[var(--color-accent)]" />
                      )}
                      {header.column.getIsSorted() === 'desc' && (
                        <ArrowDown size={12} className="text-[var(--color-accent)]" />
                      )}
                      {header.column.getCanSort() && !header.column.getIsSorted() && (
                        <ArrowUp size={10} className="text-[var(--color-border)] opacity-50" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-panel-bg)]/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex items-center justify-between">
        <span>
          {rows.length} rows
          {editable && <span className="ml-2 text-[var(--color-accent)]">(double-click cell to edit)</span>}
        </span>
        <div className="flex gap-1">
          <button
            onClick={async () => {
              const csv = exportToCSV(columns, rows);
              const path = await save({ defaultPath: 'export.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
              if (path) await writeTextFile(path, csv);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--color-panel-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            title="Export CSV"
          >
            <FileSpreadsheet size={12} />
            CSV
          </button>
          <button
            onClick={async () => {
              const json = exportToJSON(columns, rows);
              const path = await save({ defaultPath: 'export.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
              if (path) await writeTextFile(path, json);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--color-panel-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            title="Export JSON"
          >
            <FileJson size={12} />
            JSON
          </button>
        </div>
      </div>
    </div>
  );
};
