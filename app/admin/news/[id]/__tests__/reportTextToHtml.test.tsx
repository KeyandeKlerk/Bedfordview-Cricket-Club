import { describe, it, expect } from 'vitest'
import { reportTextToHtml } from '../page'

describe('reportTextToHtml', () => {
  it('wraps each blank-line-separated paragraph in <p> tags', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
    expect(reportTextToHtml(text)).toBe(
      '<p>First paragraph.</p><p>Second paragraph.</p><p>Third paragraph.</p>'
    )
  })

  it('collapses runs of more than two newlines into a single paragraph break', () => {
    const text = 'One.\n\n\n\nTwo.'
    expect(reportTextToHtml(text)).toBe('<p>One.</p><p>Two.</p>')
  })

  it('drops blank/whitespace-only paragraphs', () => {
    const text = 'One.\n\n   \n\nTwo.'
    expect(reportTextToHtml(text)).toBe('<p>One.</p><p>Two.</p>')
  })

  it('escapes &, <, > to prevent unintended HTML injection', () => {
    const text = 'BCC beat Opponents & Co <script>alert(1)</script> by 5 wickets.'
    expect(reportTextToHtml(text)).toBe(
      '<p>BCC beat Opponents &amp; Co &lt;script&gt;alert(1)&lt;/script&gt; by 5 wickets.</p>'
    )
  })

  it('returns an empty string for empty input', () => {
    expect(reportTextToHtml('')).toBe('')
  })

  it('handles single-paragraph text with no blank lines', () => {
    expect(reportTextToHtml('Just one paragraph.')).toBe('<p>Just one paragraph.</p>')
  })
})
