import { describe, it, expect } from 'vitest'
import { formatCsvCell } from '../csv'

describe('formatCsvCell', () => {
  it('quotes a plain string value', () => {
    expect(formatCsvCell('Bedfordview CC')).toBe('"Bedfordview CC"')
  })

  it('escapes embedded double quotes', () => {
    expect(formatCsvCell('6" pizza')).toBe('"6"" pizza"')
  })

  it('neutralizes a leading = to prevent formula execution', () => {
    expect(formatCsvCell("=cmd|'/c calc'!A1")).toBe('"\'=cmd|\'/c calc\'!A1"')
  })

  it('neutralizes a leading + to prevent formula execution', () => {
    expect(formatCsvCell('+HYPERLINK("http://evil.example","click")')).toBe(
      '"\'+HYPERLINK(""http://evil.example"",""click"")"'
    )
  })

  it('neutralizes a leading - to prevent formula execution', () => {
    expect(formatCsvCell('-2+3+cmd|\' /C calc\'!A0')).toBe('"\'-2+3+cmd|\' /C calc\'!A0"')
  })

  it('neutralizes a leading @ to prevent formula execution', () => {
    expect(formatCsvCell('@SUM(1+1)')).toBe('"\'@SUM(1+1)"')
  })

  it('does not alter values that do not start with a formula-trigger character', () => {
    expect(formatCsvCell('John Smith')).toBe('"John Smith"')
  })

  it('does not treat a legitimate "R-12.50" style total as a formula', () => {
    expect(formatCsvCell('R-12.50')).toBe('"R-12.50"')
  })
})
