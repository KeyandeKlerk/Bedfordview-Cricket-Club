/**
 * Formats a single value as a quoted, CSV-injection-safe cell.
 *
 * Two protections are applied:
 * 1. Embedded double quotes are escaped by doubling (`"` -> `""`), per RFC 4180.
 * 2. If the value's string representation begins with a character that
 *    spreadsheet applications (Excel, Google Sheets, LibreOffice Calc) treat
 *    as a formula trigger (`=`, `+`, `-`, `@`), a leading single quote is
 *    prepended inside the quoted field. This forces those apps to render the
 *    value as literal text instead of evaluating it as a formula, without
 *    changing the value for any other case.
 */
export function formatCsvCell(value: unknown): string {
  let str = String(value)

  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`
  }

  return `"${str.replace(/"/g, '""')}"`
}

/** Joins pre-formatted cell values into a single CSV row. */
export function formatCsvRow(values: unknown[]): string {
  return values.map(formatCsvCell).join(',')
}
