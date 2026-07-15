import { describe, it, expect } from 'vitest'
import { resolveExcerpt } from '../page'

describe('resolveExcerpt', () => {
  it('returns the explicit excerpt when one is set', () => {
    expect(resolveExcerpt('Custom excerpt.', '<p>Full article content here.</p>')).toBe('Custom excerpt.')
  })

  it('derives an excerpt from content when excerpt is null', () => {
    expect(resolveExcerpt(null, '<p>Bedfordview thrashed the visitors in a one-sided contest.</p>')).toBe(
      'Bedfordview thrashed the visitors in a one-sided contest.'
    )
  })

  it('derives an excerpt from content when excerpt is an empty string', () => {
    expect(resolveExcerpt('', '<p>Some derived text.</p>')).toBe('Some derived text.')
  })

  it('derives an excerpt from content when excerpt is whitespace-only', () => {
    expect(resolveExcerpt('   ', '<p>Some derived text.</p>')).toBe('Some derived text.')
  })
})
