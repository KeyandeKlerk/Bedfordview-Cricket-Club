# News/Blog Rich Content & Image Upload — Design

Date: 2026-07-14
Status: Approved for planning

## Problem

The admin news editor (`app/admin/news/[id]/page.tsx`) is a plain `<textarea>` labelled "Content (Markdown)" with no image support anywhere in the app. There is no Supabase Storage bucket, no upload API, and no rich text editor dependency in the codebase. Admins (non-technical club volunteers) need to write blog-style posts with images placed flexibly throughout the body, plus the common blog features a club news section needs: a featured/cover image, categories, draft/schedule/publish workflow, and basic SEO fields.

Existing content will be wiped/recreated as part of this change — no migration of legacy markdown content is required.

## Goals

- Rich text (WYSIWYG) editing with images insertable anywhere in the flow of text (toolbar, drag-drop, paste)
- Images uploaded to Supabase Storage, auto-resized client-side before upload
- Featured/cover image + alt text, shown on list cards and article header
- Fixed-list categories with filtering on the public news page
- Draft / Scheduled / Published workflow (explicit, not an ambiguous toggle)
- SEO meta description field
- Secure HTML rendering on the public site (real sanitizer, not the current regex-based one)

## Non-goals

- Migrating/preserving existing article content (will be wiped/recreated)
- Multi-author collaboration/versioning/revision history
- Image galleries or fixed multi-slot layouts (superseded by free inline placement)
- Free-form tags (fixed dropdown category only)

## Architecture Overview

Consistent with the existing pattern in this codebase where admin CRUD (e.g. `articles`, `products`) is done via direct client-side Supabase calls under RLS, rather than API routes (API routes are reserved for operations needing the service-role key). Image upload follows the same convention: the admin browser uploads directly to Supabase Storage using the authenticated session, gated by storage RLS policies that check `has_role(auth.uid(), 'admin')`.

```
Admin editor (Tiptap)
  → user picks/drags/pastes image
  → client-side resize/re-encode (canvas)
  → upload to Storage bucket `news-images` (RLS: admin write, public read)
  → public URL inserted into editor content at cursor
  → on save: sanitized HTML written to articles.content
```

## Database changes

New migration `supabase/migrations/034_article_images_categories.sql` (latest existing migration at time of writing is `033_is_demo.sql`):

```sql
alter table articles
  add column featured_image_url text,
  add column featured_image_alt text,
  add column category text check (category in
    ('match_report','club_news','junior_section','announcement','general')),
  add column meta_description text;
```

No new column for scheduling: `published_at` already supports a future timestamp, and the existing RLS policy on `articles` already filters public `SELECT` to `published_at <= now()`. Only the admin UI needs to change to expose scheduling explicitly (see below).

## Supabase Storage

New bucket: `news-images`.
- Public read (published article images must load fast via CDN; unpublished-but-uploaded images are reachable by direct URL only, same accepted tradeoff as any public media bucket)
- INSERT/DELETE restricted via storage RLS policy checking `has_role(auth.uid(), 'admin')`
- Path convention: `news-images/{admin_user_id}/{timestamp}-{random}.{ext}` — decoupled from article id so uploads work in an unsaved new draft

## Components

### `lib/images/resize.ts`
Pure browser-canvas helper: takes a `File`, returns a resized/re-encoded `Blob` (max width 1600px, JPEG/WebP re-encode, quality ~0.82). No new dependency — Canvas API covers this.

### `lib/supabase/storage.ts`
Thin helper: `uploadNewsImage(file: Blob, userId: string): Promise<string>` — resizes, uploads to `news-images`, returns the public URL. Single place both the featured-image uploader and the in-editor image button call into.

### `components/admin/ArticleEditor.tsx`
Tiptap-based rich text editor replacing the `<textarea>`. Toolbar: bold/italic, H2/H3, bullet/numbered list, blockquote, link, undo/redo, image button. Image insertion via toolbar button, drag-and-drop, or paste — all three route through `uploadNewsImage()` and insert a Tiptap image node at the cursor. Image node supports left/center/right/full-width alignment and an optional caption.

### `lib/content/sanitize.ts`
Wraps `isomorphic-dompurify` (new dependency) with an explicit allow-list: `p, h2, h3, h4, ul, ol, li, blockquote, a[href], img[src|alt|width|class], strong, em, br`. Used both when saving (defense in depth) and when rendering on the public page. Replaces the current regex-based `sanitizeHtml()` in `app/(public)/news/[slug]/page.tsx`, which is too weak to trust for admin-authored HTML containing images.

## Admin UX changes

`app/admin/news/[id]/page.tsx`:
- Swap `<textarea>` for `<ArticleEditor>`
- Add featured image uploader (click or drag/drop) + alt text field
- Add category `<select>` (fixed list from schema)
- Add meta description `<textarea>` with a live character counter (~155 char guidance)
- Replace the single publish toggle with three explicit actions: **Save Draft** (`published_at = null`), **Publish Now** (`published_at = now()`), **Schedule** (opens a date-time picker, writes a future `published_at`)

`app/admin/news/page.tsx`:
- Status badge becomes three states: Draft (`published_at` null) / Scheduled (`published_at` in future) / Published (`published_at` in past)
- Add category column + filter

## Public site changes

`app/(public)/news/page.tsx`:
- List cards show featured image thumbnail via `next/image` (using the already-configured `*.supabase.co` remote pattern in `next.config.js`) and a category badge
- Add category filter dropdown

`app/(public)/news/[slug]/page.tsx`:
- Render featured image as a header banner
- Render category badge
- Replace `renderMarkdown()` + regex `sanitizeHtml()` entirely with `sanitize()` from `lib/content/sanitize.ts`, rendered via `dangerouslySetInnerHTML`

## Error handling

- Upload failures (network, file too large, unsupported type) surface as inline errors in the editor toolbar/uploader, not silent failures — the admin must see why an image didn't insert.
- Enforce a max source file size client-side (e.g. 15MB pre-resize) with a clear error message before attempting resize/upload.
- Sanitizer runs on both save and render — a save-time sanitize prevents storing anything unexpected; a render-time sanitize protects against any future direct DB edits bypassing the editor.

## Testing

- Vitest unit tests:
  - `lib/images/resize.ts` — dimension math (downscale only when over max width, aspect ratio preserved)
  - `lib/content/sanitize.ts` — feed `<script>`, `onerror=`, `javascript:` payloads and confirm stripped; feed legit `<img>`/`<p>`/`<a href>` and confirm preserved
  - Category/schedule validation logic in the editor save path
- Playwright e2e: admin creates an article with a featured image and an inline image, schedules/publishes it, and it renders correctly on the public news list and article page.

## Dependencies added

- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image` (or equivalent image extension) — rich text editing
- `isomorphic-dompurify` — HTML sanitization
