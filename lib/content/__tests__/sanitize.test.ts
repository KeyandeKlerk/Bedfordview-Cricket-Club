import { describe, it, expect } from 'vitest'
import { sanitizeArticleHtml } from '../sanitize'

describe('sanitizeArticleHtml', () => {
  it('strips <script> tags', () => {
    const out = sanitizeArticleHtml('<p>Hello</p><script>alert(1)</script>')
    expect(out).not.toContain('<script')
    expect(out).toContain('<p>Hello</p>')
  })

  it('strips inline event handlers', () => {
    const out = sanitizeArticleHtml('<img src="x.jpg" onerror="alert(1)">')
    expect(out).not.toContain('onerror')
  })

  it('strips javascript: URLs from links', () => {
    const out = sanitizeArticleHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
  })

  it('preserves allowed formatting tags', () => {
    const out = sanitizeArticleHtml('<h2>Title</h2><p><strong>bold</strong> <em>italic</em></p>')
    expect(out).toContain('<h2>Title</h2>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<em>italic</em>')
  })

  it('preserves img tags with src, alt, width, and class attributes', () => {
    const out = sanitizeArticleHtml(
      '<img src="https://x.supabase.co/a.jpg" alt="A caption" width="800" class="article-img align-left">'
    )
    expect(out).toContain('src="https://x.supabase.co/a.jpg"')
    expect(out).toContain('alt="A caption"')
    expect(out).toContain('class="article-img align-left"')
  })

  it('preserves links with href', () => {
    const out = sanitizeArticleHtml('<a href="https://example.com">link</a>')
    expect(out).toContain('href="https://example.com"')
  })

  it('strips disallowed tags like iframe', () => {
    const out = sanitizeArticleHtml('<iframe src="https://evil.com"></iframe><p>safe</p>')
    expect(out).not.toContain('<iframe')
    expect(out).toContain('<p>safe</p>')
  })

  it('strips data:image/svg+xml URIs from img src (SVG can carry script payloads)', () => {
    const out = sanitizeArticleHtml(
      '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+">'
    )
    expect(out).not.toContain('data:')
    expect(out).not.toContain('svg+xml')
  })

  it('strips plain data:image/png URIs from img src', () => {
    const out = sanitizeArticleHtml('<img src="data:image/png;base64,iVBORw0KGgo=">')
    expect(out).not.toContain('data:')
  })

  it('forces rel="noopener noreferrer" on links with target="_blank"', () => {
    const out = sanitizeArticleHtml('<a href="https://example.com" target="_blank">link</a>')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('href="https://example.com"')
  })

  it('does not alter https:// href/src that have no target="_blank"', () => {
    const out = sanitizeArticleHtml(
      '<a href="https://example.com">link</a><img src="https://x.supabase.co/a.jpg">'
    )
    expect(out).toBe('<a href="https://example.com">link</a><img src="https://x.supabase.co/a.jpg">')
  })
})
