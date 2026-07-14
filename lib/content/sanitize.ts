import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'a', 'img',
]

const ALLOWED_ATTR = ['href', 'src', 'alt', 'width', 'class', 'data-align', 'target', 'rel']

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}
