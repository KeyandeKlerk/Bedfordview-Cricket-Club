import { describe, it, expect } from 'vitest'
import { deriveExcerpt } from '../excerpt'

describe('deriveExcerpt', () => {
  it('strips HTML tags', () => {
    expect(deriveExcerpt('<p>Hello <strong>world</strong>.</p>')).toBe('Hello world.')
  })

  it('collapses whitespace left by stripped tags', () => {
    expect(deriveExcerpt('<p>One</p><p>Two</p>')).toBe('One Two')
  })

  it('decodes basic HTML entities', () => {
    expect(deriveExcerpt('<p>Rock &amp; Roll &lt;3&gt;</p>')).toBe('Rock & Roll <3>')
  })

  it('returns short text unchanged', () => {
    expect(deriveExcerpt('<p>Short text.</p>')).toBe('Short text.')
  })

  it('truncates long text on a word boundary and appends an ellipsis', () => {
    const html = `<p>${'word '.repeat(40).trim()}</p>`
    const result = deriveExcerpt(html, 20)
    expect(result.length).toBeLessThanOrEqual(21)
    expect(result.endsWith('…')).toBe(true)
    expect(result).not.toContain(' …')
  })

  it('returns an empty string for empty input', () => {
    expect(deriveExcerpt('')).toBe('')
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(deriveExcerpt('<p>   </p>')).toBe('')
  })
})
