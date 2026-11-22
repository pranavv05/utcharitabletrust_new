/** Neutralise spreadsheet formula prefixes, including leading control characters. */
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function toCsv(rows: Record<string, unknown>[]) {
  const keys = Array.from(new Set(rows.flatMap(Object.keys)));
  return (
    '\uFEFF' +
    [keys.map(csvCell).join(','), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(','))].join('\r\n')
  );
}
