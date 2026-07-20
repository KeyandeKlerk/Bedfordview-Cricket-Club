import { describe, it, expect } from 'vitest'
import { age, isOldEnoughToClaim, validateDependentForm, CLAIM_AGE_THRESHOLD } from '../family'

describe('age', () => {
  it('computes whole years between two dates', () => {
    expect(age('2010-01-01', new Date('2026-01-01'))).toBe(16)
  })

  it('does not round up before the birthday has passed this year', () => {
    expect(age('2010-06-15', new Date('2026-01-01'))).toBe(15)
  })

  it('counts the birthday itself as the new age', () => {
    expect(age('2010-06-15', new Date('2026-06-15'))).toBe(16)
  })
})

describe('isOldEnoughToClaim', () => {
  it('returns false when dob is null', () => {
    expect(isOldEnoughToClaim(null)).toBe(false)
  })

  it(`returns false below ${CLAIM_AGE_THRESHOLD}`, () => {
    const tooYoung = new Date()
    tooYoung.setFullYear(tooYoung.getFullYear() - (CLAIM_AGE_THRESHOLD - 1))
    expect(isOldEnoughToClaim(tooYoung.toISOString().slice(0, 10))).toBe(false)
  })

  it(`returns true at or above ${CLAIM_AGE_THRESHOLD}`, () => {
    const oldEnough = new Date()
    oldEnough.setFullYear(oldEnough.getFullYear() - CLAIM_AGE_THRESHOLD)
    expect(isOldEnoughToClaim(oldEnough.toISOString().slice(0, 10))).toBe(true)
  })
})

describe('validateDependentForm', () => {
  it('requires a first and last name', () => {
    expect(validateDependentForm({ firstName: '', lastName: 'Smith', dateOfBirth: '2015-01-01' }))
      .toMatch(/name/i)
    expect(validateDependentForm({ firstName: 'Sam', lastName: '  ', dateOfBirth: '2015-01-01' }))
      .toMatch(/name/i)
  })

  it('requires a date of birth', () => {
    expect(validateDependentForm({ firstName: 'Sam', lastName: 'Smith', dateOfBirth: '' }))
      .toMatch(/date of birth/i)
  })

  it('rejects a future date of birth', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(validateDependentForm({
      firstName: 'Sam', lastName: 'Smith', dateOfBirth: future.toISOString().slice(0, 10),
    })).toMatch(/future/i)
  })

  it('passes for valid input', () => {
    expect(validateDependentForm({ firstName: 'Sam', lastName: 'Smith', dateOfBirth: '2015-01-01' }))
      .toBeNull()
  })
})
