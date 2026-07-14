import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'a', 'img',
]

const ALLOWED_ATTR = ['href', 'src', 'alt', 'width', 'class', 'data-align', 'target', 'rel']

// Restrict href/src to http(s) or relative/fragment URLs. This alone is NOT
// sufficient to block `data:` URIs on <img src>: DOMPurify has a separate,
// hard-coded DATA_URI_TAGS allowlist (img/audio/video/source/image/track)
// that permits `data:` on those tags' URI attributes regardless of
// ALLOWED_URI_REGEXP, and the public API only exposes a way to *extend*
// that allowlist (ADD_DATA_URI_TAGS), not shrink or disable it. So `data:`
// is stripped explicitly in the uponSanitizeAttribute hook below.
const SAFE_URI_REGEXP = /^(?:(?:https?):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

// Hooks are registered once at module load (not per sanitize() call) per
// the DOMPurify docs, since they attach to the shared DOMPurify instance.

// Finding 1: strip `data:` URIs from href/src outright. This runs before
// DOMPurify's own URI validation, so it closes the DATA_URI_TAGS bypass
// described above (e.g. <img src="data:image/svg+xml;base64,...">, which
// can carry an inline <svg onload="..."> payload rendered on the public
// site via dangerouslySetInnerHTML).
DOMPurify.addHook('uponSanitizeAttribute', (_node, event) => {
  if (
    (event.attrName === 'href' || event.attrName === 'src') &&
    /^\s*data:/i.test(event.attrValue)
  ) {
    event.keepAttr = false
  }
})

// Finding 2: force rel="noopener noreferrer" on any link opened in a new
// tab, to prevent reverse tabnabbing (the opened page could otherwise use
// window.opener to navigate the original tab to a phishing page).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
  })
}
