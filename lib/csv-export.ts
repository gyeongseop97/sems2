/** Quote CSV cells and keep spreadsheet programs from interpreting text as formulas. */
export function csvEscape(value: string | number): string {
  const text = String(value);
  const safeText = typeof value === "string" && (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) ? "'" + text : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}
