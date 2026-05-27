import { describe, it, expect } from 'vitest'
import { overs, fmt, bestFigures, formatDate, labelDismissal } from '../formatters'

describe('overs()', () => {
  it('returns "—" for null', () => {
    expect(overs(null)).toBe('—')
  })
  it('returns "0.0" for 0 balls', () => {
    expect(overs(0)).toBe('0.0')
  })
  it('returns "0.5" for 5 balls (partial over)', () => {
    expect(overs(5)).toBe('0.5')
  })
  it('returns "1.0" for 6 balls (exact over)', () => {
    expect(overs(6)).toBe('1.0')
  })
  it('returns "1.1" for 7 balls', () => {
    expect(overs(7)).toBe('1.1')
  })
  it('returns "10.0" for 60 balls', () => {
    expect(overs(60)).toBe('10.0')
  })
})

describe('fmt()', () => {
  it('returns "—" for null', () => {
    expect(fmt(null)).toBe('—')
  })
  it('returns "—" for undefined', () => {
    expect(fmt(undefined)).toBe('—')
  })
  it('returns "—" for empty string', () => {
    expect(fmt('')).toBe('—')
  })
  it('returns "0" for integer 0', () => {
    expect(fmt(0)).toBe('0')
  })
  it('returns "42" for integer 42', () => {
    expect(fmt(42)).toBe('42')
  })
  it('returns "33.33" for 33.333 (2dp default)', () => {
    expect(fmt(33.333)).toBe('33.33')
  })
  it('respects dp parameter', () => {
    expect(fmt(1.1234, 1)).toBe('1.1')
  })
  it('returns "—" for NaN string', () => {
    expect(fmt('not-a-number')).toBe('—')
  })
})

describe('bestFigures()', () => {
  it('returns "—" when wickets is null', () => {
    expect(bestFigures(null, 30)).toBe('—')
  })
  it('returns "—" when wickets is 0', () => {
    expect(bestFigures(0, 30)).toBe('—')
  })
  it('returns "3/24" for 3 wickets 24 runs', () => {
    expect(bestFigures(3, 24)).toBe('3/24')
  })
  it('returns "5/—" when runs is null', () => {
    expect(bestFigures(5, null)).toBe('5/—')
  })
})

describe('formatDate()', () => {
  it('returns "—" for null', () => {
    expect(formatDate(null)).toBe('—')
  })
  it('returns "—" for undefined', () => {
    expect(formatDate(undefined)).toBe('—')
  })
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2026-01-15T00:00:00Z')
    expect(result).toBeTruthy()
    expect(result).not.toBe('—')
    expect(result).toMatch(/2026/)
  })
})

describe('labelDismissal()', () => {
  it('returns "Not Out" for null', () => {
    expect(labelDismissal(null)).toBe('Not Out')
  })
  it('maps "bowled" to "Bowled"', () => {
    expect(labelDismissal('bowled')).toBe('Bowled')
  })
  it('maps "caught" to "Caught"', () => {
    expect(labelDismissal('caught')).toBe('Caught')
  })
  it('maps "run_out" to "Run Out"', () => {
    expect(labelDismissal('run_out')).toBe('Run Out')
  })
  it('maps "lbw" to "LBW"', () => {
    expect(labelDismissal('lbw')).toBe('LBW')
  })
  it('maps "stumped" to "Stumped"', () => {
    expect(labelDismissal('stumped')).toBe('Stumped')
  })
  it('maps "caught_bowled" to "C&B"', () => {
    expect(labelDismissal('caught_bowled')).toBe('C&B')
  })
  it('falls back to the raw string for unknown types', () => {
    expect(labelDismissal('mystery_dismissal')).toBe('mystery_dismissal')
  })
})
