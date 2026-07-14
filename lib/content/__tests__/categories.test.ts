import { describe, it, expect } from 'vitest'
import { ARTICLE_CATEGORIES, categoryLabel } from '../categories'

describe('categoryLabel', () => {
  it('returns the matching label', () => {
    expect(categoryLabel('match_report')).toBe('Match Report')
  })

  it('falls back to General for null', () => {
    expect(categoryLabel(null)).toBe('General')
  })

  it('falls back to General for an unknown value', () => {
    expect(categoryLabel('not_a_category')).toBe('General')
  })

  it('has exactly 5 categories', () => {
    expect(ARTICLE_CATEGORIES).toHaveLength(5)
  })
})
