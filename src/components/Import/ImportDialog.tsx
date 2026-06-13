import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, FileUp, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { DbType } from '../../lib/export';
import { parseCSV, parseJSON, generateInserts, ParsedImportData } from '../../lib/import';
import { ColumnInfo } from '../../stores/activeConnectionStore';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  dbType: DbType;
  tableColumns: ColumnInfo[];
  onImport: (sqls: string[]) => Promise<void>;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  open,
  onOpenChange,
  tableName,
  dbType,
  tableColumns,
  onImport,
}) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileFormat, setFileFormat] = useState<'csv' | 'json' | null>(null);
  const [parsedData, setParsedData] = useState<ParsedImportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setFileContent(null);
      setFileName(null);
      setFileFormat(null);
      setParsedData(null);
      setError(null);
      setIsImporting(false);
      setResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (!fileContent || !fileFormat) {
      setParsedData(null);
      setError(null);
      return;
    }
    try {
      const data = fileFormat === 'csv' ? parseCSV(fileContent) : parseJSON(fileContent);
      setParsedData(data);
      setError(null);
    } catch (err) {
      setParsedData(null);
      setError(String(err));
    }
  }, [fileContent, fileFormat]);

  const handleSelectFile = async () => {
    try {
      const path = await openDialog({
        multiple: false,
        directory: false,
        filters: [
          { name: 'CSV or JSON', extensions: ['csv', 'json'] },
          { name: 'CSV', extensions: ['csv'] },
          { name: 'JSON', extensions: ['json'] },
        ],
      });
      if (typeof path !== 'string') return;
      const content = await readTextFile(path);
      const name = path.split(/[/\\]/).pop() || path;
      const ext = name.split('.').pop()?.toLowerCase();
      setFileName(name);
      setFileContent(content);
      setFileFormat(ext === 'json' ? 'json' : 'csv');
      setResult(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const matchedColumns = useMemo(() => {
    if (!parsedData) return [];
    return tableColumns.filter((c) => parsedData.columns.includes(c.name));
  }, [parsedData, tableColumns]);

  const unmatchedTableColumns = useMemo(() => {
    if (!parsedData) return [];
    return tableColumns.filter((c) => !parsedData.columns.includes(c.name));
  }, [parsedData, tableColumns]);

  const unmatchedFileColumns = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.columns.filter((c) => !tableColumns.some((tc) => tc.name === c));
  }, [parsedData, tableColumns]);

  const previewRows = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.rows.slice(0, 5);
  }, [parsedData]);

  const handleImport = async () => {
    if (!parsedData || matchedColumns.length === 0) return;
    setIsImporting(true);
    setResult(null);
    try {
      const columnNames = matchedColumns.map((c) => c.name);
      const columnIndexes = columnNames.map((name) => parsedData.columns.indexOf(name));
      const rows = parsedData.rows.map((row) => columnIndexes.map((idx) => row[idx]));
      const sqls = generateInserts(tableName, columnNames, rows, dbType);
      await onImport(sqls);
      setResult({ type: 'success', message: `Imported ${sqls.length} rows successfully.` });
    } catch (err) {
      setResult({ type: 'error', message: String(err) });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-h-[85vh] overflow-y-auto bg-[var(--color-panel-bg)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">
              Import into {tableName}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-[var(--color-main-bg)] text-[var(--color-text-muted)]">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectFile}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm bg-[var(--color-accent)] text-[var(--color-main-bg)] font-medium hover:bg-[var(--color-accent-hover)]"
              >
                <FileUp size={14} />
                Select File
              </button>
              {fileName && (
                <span className="text-sm text-[var(--color-text-muted)] truncate">
                  {fileName}
                </span>
              )}
            </div>

            {fileName && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--color-text-muted)]">Format:</label>
                <select
                  value={fileFormat || ''}
                  onChange={(e) => setFileFormat(e.target.value as 'csv' | 'json')}
                  className="px-2 py-1 bg-[var(--color-main-bg)] border border-[var(--color-border)] rounded text-xs focus:outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 text-xs text-[var(--color-danger)]">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{error}</span>
            </div>
          )}

          {parsedData && (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-[var(--color-text-muted)]">
                Found {parsedData.rows.length} rows and {parsedData.columns.length} columns.
              </div>

              {matchedColumns.length > 0 && (
                <div className="text-xs">
                  <span className="text-[var(--color-success)]">{matchedColumns.length}</span> columns will be imported:
                  <span className="ml-1 font-mono text-[var(--color-text)]">
                    {matchedColumns.map((c) => c.name).join(', ')}
                  </span>
                </div>
              )}

              {unmatchedTableColumns.length > 0 && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-danger)]">{unmatchedTableColumns.length}</span> table columns not in file:
                  <span className="ml-1 font-mono">
                    {unmatchedTableColumns.map((c) => c.name).join(', ')}
                  </span>
                </div>
              )}

              {unmatchedFileColumns.length > 0 && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-danger)]">{unmatchedFileColumns.length}</span> file columns ignored:
                  <span className="ml-1 font-mono">
                    {unmatchedFileColumns.join(', ')}
                  </span>
                </div>
              )}

              {previewRows.length > 0 && (
                <div className="border border-[var(--color-border)] rounded overflow-hidden">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-[var(--color-main-bg)]">
                      <tr>
                        {matchedColumns.map((c) => (
                          <th key={c.name} className="px-2 py-1 text-left text-[var(--color-text-muted)] font-medium">
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-t border-[var(--color-border)]">
                          {matchedColumns.map((c) => {
                            const idx = parsedData.columns.indexOf(c.name);
                            const val = row[idx];
                            return (
                              <td key={c.name} className="px-2 py-1 whitespace-nowrap">
                                {val === null ? (
                                  <span className="text-[var(--color-text-muted)] italic">NULL</span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className={`mt-4 flex items-start gap-2 text-xs ${result.type === 'success' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {result.type === 'success' ? <CheckCircle size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
              <span>{result.message}</span>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" className="px-4 py-2 rounded text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-main-bg)]">
                Close
              </button>
            </Dialog.Close>
            <button
              onClick={handleImport}
              disabled={!parsedData || matchedColumns.length === 0 || isImporting}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm bg-[var(--color-accent)] text-[var(--color-main-bg)] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting && <Loader2 size={14} className="animate-spin" />}
              {isImporting ? 'Importing...' : 'Import'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
