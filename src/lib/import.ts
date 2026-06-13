import { DbType, quoteIdentifier, formatSqlValue } from './export';

export interface ParsedImportData {
  columns: string[];
  rows: (string | number | boolean | null)[][];
}

const isBlankRow = (row: string[]): boolean => row.every((f) => f.trim() === '');

const inferValue = (value: string): string | number | boolean | null => {
  const trimmed = value.trim();
  if (value === '' || trimmed.toUpperCase() === 'NULL') return null;

  if (/^(true|TRUE|false|FALSE)$/.test(trimmed)) {
    return trimmed.toLowerCase() === 'true';
  }

  if (/^-?\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    if (Number.isSafeInteger(num)) return num;
  }

  if (/^-?\d+\.\d+$/.test(trimmed) || /^-?\d+\.\d+[eE][+-]?\d+$/.test(trimmed) || /^-?\d+[eE][+-]?\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num)) return num;
  }

  return value;
};

export const parseCSV = (text: string): ParsedImportData => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        if (!isBlankRow(currentRow)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\r') {
        currentRow.push(currentField);
        if (!isBlankRow(currentRow)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (nextChar === '\n') i++;
      } else {
        currentField += char;
      }
    }
  }

  // Handle trailing field/row
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (!isBlankRow(currentRow)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return { columns: [], rows: [] };

  const columns = rows[0];
  const dataRows = rows.slice(1);

  return {
    columns,
    rows: dataRows.map((row) => row.map(inferValue)),
  };
};

const normalizeValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

export const parseJSON = (text: string): ParsedImportData => {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('JSON import must be an array of objects');
  }
  if (parsed.length === 0) return { columns: [], rows: [] };

  const columnSet = new Set<string>();
  parsed.forEach((obj) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach((k) => columnSet.add(k));
    }
  });
  const columns = Array.from(columnSet);

  const rows = parsed.map((obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return columns.map(() => null);
    }
    return columns.map((col) => normalizeValue((obj as Record<string, unknown>)[col]));
  });

  return { columns, rows };
};

export const generateInserts = (
  table: string,
  columns: string[],
  rows: (string | number | boolean | null)[][],
  dbType: DbType
): string[] => {
  if (rows.length === 0 || columns.length === 0) return [];

  const quotedTable = quoteIdentifier(table, dbType);
  const quotedColumns = columns.map((c) => quoteIdentifier(c, dbType)).join(', ');

  return rows.map((row) => {
    const values = row.map((v) => formatSqlValue(v, dbType)).join(', ');
    return `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${values});`;
  });
};
