export interface DataTable {
  columns: string[];
  rows: (string | number)[][];
}

function cell(value: string | number): string {
  const text = String(value);
  // Il prefisso neutralizza le formule quando il file viene aperto in un foglio di calcolo.
  const safe = /^[=+\-@]/.test(text) && typeof value === 'string' ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** CSV con separatore punto e virgola, il formato che Excel italiano apre senza passaggi. */
export function toCsv(table: DataTable): string {
  return [table.columns, ...table.rows].map((row) => row.map(cell).join(';')).join('\n');
}

export function downloadCsv(table: DataTable, filename: string): void {
  const blob = new Blob([`﻿${toCsv(table)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: `${filename}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}
