export type DbType = 'mysql' | 'postgres' | 'sqlite';

export const exportToCSV = (columns: string[], rows: (string | number | boolean | null)[][]): string => {
  const escapeCSV = (value: string | number | boolean | null): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [columns.map(escapeCSV).join(',')];
  rows.forEach((row) => {
    lines.push(row.map(escapeCSV).join(','));
  });
  return lines.join('\n');
};

export const exportToJSON = (columns: string[], rows: (string | number | boolean | null)[][]): string => {
  const objects = rows.map((row) => {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
};

export const quoteIdentifier = (name: string, dbType: DbType): string => {
  if (dbType === 'mysql') {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  // postgres and sqlite use double quotes
  return `"${name.replace(/"/g, '""')}"`;
};

export const escapeSqlString = (value: string): string => {
  return value.replace(/'/g, "''");
};

export const formatSqlValue = (value: string | number | boolean | null, dbType: DbType): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') {
    if (dbType === 'sqlite') return value ? '1' : '0';
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') return String(value);
  return `'${escapeSqlString(String(value))}'`;
};

export const exportToSQLInsert = (
  table: string,
  columns: string[],
  rows: (string | number | boolean | null)[][],
  dbType: DbType = 'mysql'
): string => {
  if (rows.length === 0 || columns.length === 0) return '';

  const quotedTable = quoteIdentifier(table, dbType);
  const quotedColumns = columns.map((c) => quoteIdentifier(c, dbType)).join(', ');

  const lines: string[] = [];
  rows.forEach((row) => {
    const values = row.map((v) => formatSqlValue(v, dbType)).join(', ');
    lines.push(`INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${values});`);
  });

  return lines.join('\n');
};
