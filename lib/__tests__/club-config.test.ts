import { describe, it, expect } from 'vitest'
import { isPro, DEFAULT_CONFIG } from '../club-config'
import type { ClubConfig } from '../club-config'

describe('isPro', () => {
  it('returns false for club plan', () => {
    expect(isPro({ ...DEFAULT_CONFIG, plan: 'club' })).toBe(false)
  })

  it('returns true for pro plan', () => {
    expect(isPro({ ...DEFAULT_CONFIG, plan: 'pro' })).toBe(true)
  })
})
