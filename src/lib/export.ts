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
