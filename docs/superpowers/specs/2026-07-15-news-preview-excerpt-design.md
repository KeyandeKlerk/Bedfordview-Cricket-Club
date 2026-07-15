# News Article Preview & Auto-Excerpt — Design

## Context

The admin article editor (`app/admin/news/[id]/page.tsx`) lets an author write a draft, schedule it, or publish it, but has no way to see what the article will actually look like on the public site before committing. Separately, the public news list page (`app/(public)/news/page.tsx`) silently omits the excerpt snippet on any article card where the author left the excerpt field blank.

This spec covers two additions:
1. A "Preview" feature in the admin editor showing the article as it will render publicly, using the live (possibly unsaved) editor state.
2. An auto-generated fallback excerpt on the public news list page when an article has no excerpt set.

## 1. Article preview

### Shared rendering component

Extract the article rendering markup/styles currently inlined in `app/(public)/news/[slug]/page.tsx` (hero, category badge, publish date, featured image, sanitized body, "View full scorecard" link) into a new presentational component:

`components/ArticleView.tsx`
```ts
type ArticleViewProps = {
  title: string
  category: string | null
  dateLabel: string        // pre-formatted, e.g. "Tuesday, 15 July 2026"
  featuredImageUrl: string | null
  featuredImageAlt: string | null
  bodyHtml: string          // already sanitized
  matchId: string | null
}
```

`ArticleView` does no data fetching, formatting, or sanitizing — callers resolve those and pass plain values. This lets it run identically from a server component (public page) and a client component (preview modal).

### Public page refactor

`app/(public)/news/[slug]/page.tsx` computes `dateLabel` via its existing `formatDate()` and `bodyHtml` via the existing `sanitizeArticleHtml()`, then renders `<ArticleView />` in place of the current inline JSX. Pure refactor — no behavior change, existing query/notFound logic untouched.

### Preview modal

`components/admin/ArticlePreviewModal.tsx` — a full-screen client-side overlay, following the existing `components/scorer/*Modal.tsx` pattern.

Props: `{ title, category, featuredImageUrl, featuredImageAlt, content, matchId, onClose }` — mirrors the editor's own state shape.

Behavior:
- Sanitizes `content` client-side via the already-imported `sanitizeArticleHtml` (same function the editor calls in `save()`).
- Computes `dateLabel` from `new Date()` (today), regardless of the article's actual draft/scheduled/published state — the preview always represents "if I hit Publish Now right now."
- Renders `<ArticleView>` with the resolved props.
- Shows a fixed banner at the top: "PREVIEW — not saved or published" with a close (×) button that calls `onClose`.

### Editor integration

`app/admin/news/[id]/page.tsx`:
- Add a `showPreview` boolean state.
- Add a "Preview" button in `.editor-actions`, alongside Save Draft / Schedule / Publish Now.
- When `showPreview` is true, render `<ArticlePreviewModal>` with the editor's current in-memory state (title, category, featuredImageUrl, featuredImageAlt, content, matchId) — no save or network round-trip, so it reflects unsaved edits instantly.

### Edge cases
- Empty title/content: renders blank the same way the public page would with empty fields — no special-casing.
- No featured image: featured-image block omitted, same as the public page today.
- `matchId` set: "View full scorecard →" link renders and is clickable (real navigation to `/results/[id]`), matching the live public page for full fidelity. Clicking it navigates away from the admin editor, same as any other real link — acceptable, no special handling.

### Testing
- Extend the existing admin news e2e spec: open editor, type a title/content, click Preview, assert the overlay shows the typed title/content and a close button, and that closing returns to the editor with fields intact.
- Light smoke test for `ArticleView` rendering (title, category badge, body html, conditional featured image / match link) since it's now a shared, independently testable unit.

## 2. Auto-generated excerpt fallback

### Helper

`lib/content/excerpt.ts`
```ts
export function deriveExcerpt(html: string, maxLen = 155): string
```
Strips HTML tags, collapses whitespace, decodes basic entities (`&amp;`, `&lt;`, `&gt;`), and truncates to `maxLen` on a word boundary, appending "…" if truncated. Returns `''` for empty/whitespace-only input.

### News list page

`app/(public)/news/page.tsx`:
- Add `content` to the existing `select()` column list.
- Per card, compute `const excerptText = a.excerpt?.trim() || deriveExcerpt(a.content)`.
- Render `{excerptText && <div className="article-card-excerpt">{excerptText}</div>}` in place of the current `a.excerpt && ...` check.

Purely derived at render time — no DB/migration changes, no writes to the `excerpt` column, and it always reflects the article's current content even if content is edited after the fact.

### Testing
- Unit tests for `deriveExcerpt`: strips tags, truncates on word boundary with ellipsis, handles empty/short input, decodes entities.
- Extend or add a light test/assertion on the news list page confirming a card with no excerpt shows derived text from its content, and a card with an explicit excerpt shows that instead.

## Out of scope
- No changes to `meta_description` (already a separate, explicit SEO field).
- No persistence of the derived excerpt back to the `excerpt` column.
- No preview support for the "scheduled" date display — preview always shows today's date per the design decision above.
