# News Blog Rich Content & Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain-textarea news editor with a rich text (Tiptap) editor supporting inline images placed anywhere in the post, plus a featured image, categories, draft/schedule/publish workflow, and SEO fields.

**Architecture:** Admins upload images directly from the browser to a new Supabase Storage bucket (`news-images`), gated by storage RLS checking `has_role(auth.uid(), 'admin')` — the same client-side-under-RLS pattern this codebase already uses for all admin CRUD. Rich text is authored in Tiptap and saved as sanitized HTML in the existing `articles.content` column. The public site sanitizes with `isomorphic-dompurify` (replacing the current regex sanitizer) before rendering.

**Tech Stack:** Next.js 15 App Router, React 19, Supabase (Postgres + Storage), Tiptap v2 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`), `isomorphic-dompurify`, vitest, Playwright.

## Global Constraints

- Follow the existing pattern: admin CRUD is done via direct client-side `supabase.from(...)` calls under RLS, not API routes (API routes are reserved for service-role operations). Image upload follows the same convention.
- Existing article content will be wiped/recreated — no legacy-markdown-fallback rendering path is needed.
- New Storage bucket `news-images`: public read, INSERT/DELETE restricted to `admin` role via `has_role(auth.uid(), 'admin')`.
- No new column for scheduling — `published_at` already supports a future timestamp and the public RLS policy already filters `published_at <= now()`.
- Categories are a fixed list (not free-form tags): `match_report`, `club_news`, `junior_section`, `announcement`, `general`.
- Match the existing design system: `Syne` (headings) + `Outfit` (body) fonts, navy `#050c1a` background, blue accents (`#2563eb`/`#3b82f6`), sky `#38bdf8` highlight, scoped `<style>{...}</style>` tags per component (no CSS modules).
- Scope trim from the design doc: image **captions** are dropped in favor of alignment only (left/center/right/full-width) + required alt text — a dedicated caption node is unnecessary complexity; admins can add caption-like text as a normal paragraph under an image. Alt text still covers accessibility/SEO.
- Testability convention already used in this codebase (`lib/offline/queue.ts`): functions that call Supabase accept the client as a parameter (dependency injection) rather than importing the singleton, so tests can pass a fake client object. Follow this for `lib/supabase/storage.ts`.
- Canvas-based image resizing cannot run under vitest (no real `<canvas>` in Node or jsdom without native deps) — only the pure dimension-math is unit tested; the actual canvas draw/encode is covered by the Playwright e2e test in Task 14.

---

### Task 1: Database migration — article columns, categories constant, and Storage bucket

**Files:**
- Create: `supabase/migrations/034_article_images_categories.sql`
- Create: `lib/content/categories.ts`
- Test: `lib/content/__tests__/categories.test.ts`

**Interfaces:**
- Produces: `ARTICLE_CATEGORIES: { value: string; label: string }[]` and `type ArticleCategory = typeof ARTICLE_CATEGORIES[number]['value']` — imported by Tasks 9, 11, 12, 13.
- Produces (DB): `articles.featured_image_url text`, `articles.featured_image_alt text`, `articles.category text`, `articles.meta_description text`; Storage bucket `news-images`.

- [ ] **Step 1: Write the categories module and its test**

`lib/content/categories.ts`:
```ts
export const ARTICLE_CATEGORIES = [
  { value: 'match_report', label: 'Match Report' },
  { value: 'club_news', label: 'Club News' },
  { value: 'junior_section', label: 'Junior Section' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'general', label: 'General' },
] as const

export type ArticleCategory = typeof ARTICLE_CATEGORIES[number]['value']

export function categoryLabel(value: string | null): string {
  return ARTICLE_CATEGORIES.find(c => c.value === value)?.label ?? 'General'
}
```

`lib/content/__tests__/categories.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/content/__tests__/categories.test.ts`
Expected: FAIL with "Cannot find module '../categories'"

- [ ] **Step 3: Create `lib/content/categories.ts` with the code from Step 1**

(Already written above — create the file.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/content/__tests__/categories.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the migration**

`supabase/migrations/034_article_images_categories.sql`:
```sql
-- 034_article_images_categories.sql
-- Adds featured image, category, and meta description columns to articles.
-- Adds the news-images Storage bucket with admin-write / public-read RLS.

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS featured_image_url text,
  ADD COLUMN IF NOT EXISTS featured_image_alt text,
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('match_report', 'club_news', 'junior_section', 'announcement', 'general')),
  ADD COLUMN IF NOT EXISTS meta_description text;

-- Storage bucket for article images (featured + inline)
INSERT INTO storage.buckets (id, name, public)
VALUES ('news-images', 'news-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read news-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'news-images');

CREATE POLICY "admin write news-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'news-images' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete news-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'news-images' AND has_role(auth.uid(), 'admin'));
```

- [ ] **Step 6: Apply the migration**

Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor), in order after migration 033. Then verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'articles' AND column_name IN
  ('featured_image_url', 'featured_image_alt', 'category', 'meta_description');
-- expect 4 rows

SELECT id, public FROM storage.buckets WHERE id = 'news-images';
-- expect 1 row, public = true
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/034_article_images_categories.sql lib/content/categories.ts lib/content/__tests__/categories.test.ts
git commit -m "feat: add article image/category columns and news-images storage bucket"
```

---

### Task 2: Image resize helper — pure dimension math

**Files:**
- Create: `lib/images/resize.ts`
- Test: `lib/images/__tests__/resize.test.ts`

**Interfaces:**
- Produces: `computeResizedDimensions(width: number, height: number, maxWidth: number): { width: number; height: number }` — consumed by Task 2's own `resizeImageFile` and by the editor's upload path in Task 6.
- Produces: `resizeImageFile(file: File, opts?: { maxWidth?: number; quality?: number }): Promise<Blob>` — consumed by Task 6.

- [ ] **Step 1: Write the failing test for `computeResizedDimensions`**

`lib/images/__tests__/resize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeResizedDimensions } from '../resize'

describe('computeResizedDimensions', () => {
  it('leaves dimensions unchanged when already under maxWidth', () => {
    expect(computeResizedDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('downscales width to maxWidth and preserves aspect ratio', () => {
    expect(computeResizedDimensions(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 })
  })

  it('downscales a portrait image by width, preserving aspect ratio', () => {
    // 2000x4000 -> maxWidth 1600 -> scale 0.8 -> height 3200
    expect(computeResizedDimensions(2000, 4000, 1600)).toEqual({ width: 1600, height: 3200 })
  })

  it('treats a width exactly at maxWidth as already fitting', () => {
    expect(computeResizedDimensions(1600, 900, 1600)).toEqual({ width: 1600, height: 900 })
  })

  it('rounds fractional heights to the nearest integer', () => {
    // 1000x333 -> maxWidth 700 -> scale 0.7 -> height 233.1 -> 233
    expect(computeResizedDimensions(1000, 333, 700)).toEqual({ width: 700, height: 233 })
  })
})

describe('assertFileSize', () => {
  it('does not throw for a file under the limit', async () => {
    const { assertFileSize } = await import('../resize')
    expect(() => assertFileSize({ size: 5 * 1024 * 1024 } as File)).not.toThrow()
  })

  it('throws ImageTooLargeError for a file over the default 15MB limit', async () => {
    const { assertFileSize, ImageTooLargeError } = await import('../resize')
    expect(() => assertFileSize({ size: 20 * 1024 * 1024 } as File)).toThrow(ImageTooLargeError)
  })

  it('respects a custom max size', async () => {
    const { assertFileSize, ImageTooLargeError } = await import('../resize')
    expect(() => assertFileSize({ size: 2 * 1024 * 1024 } as File, 1 * 1024 * 1024)).toThrow(ImageTooLargeError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/images/__tests__/resize.test.ts`
Expected: FAIL with "Cannot find module '../resize'"

- [ ] **Step 3: Implement `lib/images/resize.ts`**

```ts
export function computeResizedDimensions(
  width: number,
  height: number,
  maxWidth: number
): { width: number; height: number } {
  if (width <= maxWidth) return { width, height }
  const scale = maxWidth / width
  return { width: maxWidth, height: Math.round(height * scale) }
}

export const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024

export class ImageTooLargeError extends Error {}

export function assertFileSize(file: File, maxBytes: number = MAX_SOURCE_FILE_BYTES): void {
  if (file.size > maxBytes) {
    throw new ImageTooLargeError(
      `Image is ${(file.size / 1024 / 1024).toFixed(1)}MB — max allowed is ${(maxBytes / 1024 / 1024).toFixed(0)}MB.`
    )
  }
}

/**
 * Downscales/re-encodes an image file in the browser via <canvas>.
 * Not unit-testable (no real canvas 2d context in Node/jsdom) — exercised
 * by the Playwright e2e test in Task 14.
 */
export function resizeImageFile(
  file: File,
  opts: { maxWidth?: number; quality?: number } = {}
): Promise<Blob> {
  assertFileSize(file)
  const maxWidth = opts.maxWidth ?? 1600
  const quality = opts.quality ?? 0.82

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = computeResizedDimensions(img.width, img.height, maxWidth)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Image encoding failed')),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/images/__tests__/resize.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/images/resize.ts lib/images/__tests__/resize.test.ts
git commit -m "feat: add client-side image resize helper"
```

---

### Task 3: HTML sanitizer for article content

**Files:**
- Create: `lib/content/sanitize.ts`
- Test: `lib/content/__tests__/sanitize.test.ts`
- Modify: `package.json` (add `isomorphic-dompurify`)

**Interfaces:**
- Produces: `sanitizeArticleHtml(html: string): string` — consumed by Task 7 (save path) and Task 13 (public render path).

- [ ] **Step 1: Install the dependency**

Run: `npm install isomorphic-dompurify`
Expected: adds `isomorphic-dompurify` to `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing test**

`lib/content/__tests__/sanitize.test.ts`:
```ts
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
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/content/__tests__/sanitize.test.ts`
Expected: FAIL with "Cannot find module '../sanitize'"

- [ ] **Step 4: Implement `lib/content/sanitize.ts`**

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/content/__tests__/sanitize.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/content/sanitize.ts lib/content/__tests__/sanitize.test.ts
git commit -m "feat: add DOMPurify-based article HTML sanitizer"
```

---

### Task 4: Storage upload helper

**Files:**
- Create: `lib/supabase/storage.ts`
- Test: `lib/supabase/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (independent of resize.ts — the caller resizes first, then passes a `Blob`).
- Produces: `uploadNewsImage(supabaseClient: SupabaseLike, blob: Blob, userId: string, extension?: string): Promise<{ url: string | null; error: string | null }>` — consumed by Task 6 (inline images) and Task 8 (featured image).

- [ ] **Step 1: Write the failing test**

`lib/supabase/__tests__/storage.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { uploadNewsImage } from '../storage'

function makeSuccessSupabase() {
  return {
    storage: {
      from: () => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/news-images/${path}` } }),
      }),
    },
  } as any
}

function makeErrorSupabase() {
  return {
    storage: {
      from: () => ({
        upload: vi.fn(() => Promise.resolve({ error: { message: 'upload failed' } })),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  } as any
}

describe('uploadNewsImage', () => {
  const blob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' })

  it('returns a public URL on success', async () => {
    const result = await uploadNewsImage(makeSuccessSupabase(), blob, 'user-1')
    expect(result.error).toBeNull()
    expect(result.url).toContain('https://x.supabase.co/news-images/user-1/')
    expect(result.url).toMatch(/\.jpg$/)
  })

  it('uses the given extension', async () => {
    const result = await uploadNewsImage(makeSuccessSupabase(), blob, 'user-1', 'png')
    expect(result.url).toMatch(/\.png$/)
  })

  it('returns an error and no URL when upload fails', async () => {
    const result = await uploadNewsImage(makeErrorSupabase(), blob, 'user-1')
    expect(result.url).toBeNull()
    expect(result.error).toBe('upload failed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/supabase/__tests__/storage.test.ts`
Expected: FAIL with "Cannot find module '../storage'"

- [ ] **Step 3: Implement `lib/supabase/storage.ts`**

```ts
type SupabaseLike = {
  storage: {
    from: (bucket: string) => {
      upload: (path: string, blob: Blob) => Promise<{ error: { message: string } | null }>
      getPublicUrl: (path: string) => { data: { publicUrl: string } }
    }
  }
}

export async function uploadNewsImage(
  supabaseClient: SupabaseLike,
  blob: Blob,
  userId: string,
  extension: string = 'jpg'
): Promise<{ url: string | null; error: string | null }> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
  const bucket = supabaseClient.storage.from('news-images')
  const { error } = await bucket.upload(path, blob)
  if (error) return { url: null, error: error.message }
  const { data } = bucket.getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/supabase/__tests__/storage.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/storage.ts lib/supabase/__tests__/storage.test.ts
git commit -m "feat: add news image upload helper"
```

---

### Task 5: Tiptap dependencies + base ArticleEditor (no images yet)

**Files:**
- Modify: `package.json` (add Tiptap deps)
- Create: `components/admin/ArticleEditor.tsx`

**Interfaces:**
- Produces: `<ArticleEditor value={string} onChange={(html: string) => void} />` — a controlled rich-text editor. Consumed by Task 7 (replaces the textarea in the admin editor page) and extended in-place by Task 6 (image support).

- [ ] **Step 1: Install Tiptap**

Run: `npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link`
Expected: adds four `@tiptap/*` packages to `dependencies`.

- [ ] **Step 2: Build the base editor component**

`components/admin/ArticleEditor.tsx`:
```tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

type ArticleEditorProps = {
  value: string
  onChange: (html: string) => void
}

export default function ArticleEditor({ value, onChange }: ArticleEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return null

  const setLink = () => {
    const url = window.prompt('Link URL:', editor.getAttributes('link').href ?? '')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }

  return (
    <>
      <style>{`
        .tiptap-toolbar {
          display: flex; flex-wrap: wrap; gap: 4px;
          padding: 8px; border: 1px solid rgba(59,130,246,0.2);
          border-bottom: none; border-radius: 8px 8px 0 0;
          background: rgba(10,22,40,0.6);
        }
        .tiptap-btn {
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          padding: 6px 10px; border-radius: 6px; border: 1px solid transparent;
          background: transparent; color: rgba(147,197,253,0.7); cursor: pointer;
          transition: all 0.15s;
        }
        .tiptap-btn:hover { background: rgba(59,130,246,0.12); color: #93c5fd; }
        .tiptap-btn.is-active { background: rgba(59,130,246,0.2); color: #60a5fa; border-color: rgba(59,130,246,0.3); }
        .tiptap-content {
          border: 1px solid rgba(59,130,246,0.2); border-radius: 0 0 8px 8px;
          background: rgba(10,22,40,0.6); padding: 14px; min-height: 360px;
          color: #e2eeff; font-family: 'Outfit', sans-serif; font-size: 14px; line-height: 1.7;
        }
        .tiptap-content .ProseMirror { outline: none; min-height: 340px; }
        .tiptap-content p { margin: 0 0 1em 0; }
        .tiptap-content h2, .tiptap-content h3 { font-family: 'Syne', sans-serif; color: #f0f8ff; margin: 1em 0 0.5em; }
        .tiptap-content a { color: #38bdf8; }
      `}</style>
      <div className="tiptap-toolbar">
        <button type="button" className={`tiptap-btn ${editor.isActive('bold') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('italic') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('link') ? 'is-active' : ''}`} onClick={setLink}>Link</button>
        <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().undo().run()}>Undo</button>
        <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().redo().run()}>Redo</button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </>
  )
}
```

- [ ] **Step 3: Verify it compiles and the dev server runs**

Run: `npm run build`
Expected: build succeeds with no type errors referencing `ArticleEditor.tsx`. (No automated test for this task — it's a pure UI shell with no logic yet; it's wired up and exercised by Task 7, and behavior is covered by the Task 14 e2e test.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json components/admin/ArticleEditor.tsx
git commit -m "feat: add base Tiptap rich text editor component"
```

---

### Task 6: Inline image support in ArticleEditor

**Files:**
- Modify: `package.json` (add `@tiptap/extension-image`)
- Modify: `components/admin/ArticleEditor.tsx`

**Interfaces:**
- Consumes: `computeResizedDimensions`/`resizeImageFile` from Task 2, `uploadNewsImage` from Task 4, `supabase` singleton from `lib/supabase/client.ts`.
- Produces: `<ArticleEditor value onChange userId={string} />` (new required prop) — the `userId` is needed to namespace the Storage path. Task 7 must pass it.

- [ ] **Step 1: Install the image extension**

Run: `npm install @tiptap/extension-image`

- [ ] **Step 2: Add an alignable image extension and wire up upload**

Modify `components/admin/ArticleEditor.tsx` — add imports, the custom image extension, an `insertImageFile` helper, a toolbar upload button, and drag/drop + paste handlers:

```tsx
'use client'

import { useCallback, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { supabase } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/images/resize'
import { uploadNewsImage } from '@/lib/supabase/storage'

const AlignableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes: { align?: string }) => ({
          'data-align': attributes.align,
          class: `article-img align-${attributes.align ?? 'center'}`,
        }),
      },
    }
  },
})

type ArticleEditorProps = {
  value: string
  onChange: (html: string) => void
  userId: string
}

async function insertImageFile(editor: Editor, file: File, userId: string) {
  if (!file.type.startsWith('image/')) return
  let blob: Blob
  try {
    blob = await resizeImageFile(file)
  } catch (err) {
    window.alert(err instanceof Error ? err.message : 'Image processing failed.')
    return
  }
  const { url, error } = await uploadNewsImage(supabase, blob, userId, 'jpg')
  if (error || !url) { window.alert(`Image upload failed: ${error ?? 'unknown error'}`); return }
  editor.chain().focus().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, '') }).run()
}

export default function ArticleEditor({ value, onChange, userId }: ArticleEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      AlignableImage,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      handleDrop: (_view, event) => {
        const file = event.dataTransfer?.files?.[0]
        if (!file || !file.type.startsWith('image/')) return false
        event.preventDefault()
        insertImageFile(editorRef.current!, file, userId)
        return true
      },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.items ?? [])
          .find(item => item.type.startsWith('image/'))
          ?.getAsFile()
        if (!file) return false
        insertImageFile(editorRef.current!, file, userId)
        return true
      },
    },
  })

  // editorProps callbacks are created once by Tiptap, before `editor` exists —
  // a ref lets them reach the current editor instance without stale closures.
  const editorRef = useRef<Editor | null>(null)
  editorRef.current = editor

  const setLink = () => {
    if (!editor) return
    const url = window.prompt('Link URL:', editor.getAttributes('link').href ?? '')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }

  const onPickImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file && editor) insertImageFile(editor, file, userId)
  }, [editor, userId])

  if (!editor) return null

  return (
    <>
      <style>{`
        .tiptap-toolbar {
          display: flex; flex-wrap: wrap; gap: 4px;
          padding: 8px; border: 1px solid rgba(59,130,246,0.2);
          border-bottom: none; border-radius: 8px 8px 0 0;
          background: rgba(10,22,40,0.6);
        }
        .tiptap-btn {
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          padding: 6px 10px; border-radius: 6px; border: 1px solid transparent;
          background: transparent; color: rgba(147,197,253,0.7); cursor: pointer;
          transition: all 0.15s;
        }
        .tiptap-btn:hover { background: rgba(59,130,246,0.12); color: #93c5fd; }
        .tiptap-btn.is-active { background: rgba(59,130,246,0.2); color: #60a5fa; border-color: rgba(59,130,246,0.3); }
        .tiptap-content {
          border: 1px solid rgba(59,130,246,0.2); border-radius: 0 0 8px 8px;
          background: rgba(10,22,40,0.6); padding: 14px; min-height: 360px;
          color: #e2eeff; font-family: 'Outfit', sans-serif; font-size: 14px; line-height: 1.7;
        }
        .tiptap-content .ProseMirror { outline: none; min-height: 340px; }
        .tiptap-content p { margin: 0 0 1em 0; }
        .tiptap-content h2, .tiptap-content h3 { font-family: 'Syne', sans-serif; color: #f0f8ff; margin: 1em 0 0.5em; }
        .tiptap-content a { color: #38bdf8; }
        .tiptap-content img.article-img { max-width: 100%; border-radius: 8px; display: block; }
        .tiptap-content img.align-left { float: left; margin: 0 16px 12px 0; max-width: 45%; }
        .tiptap-content img.align-right { float: right; margin: 0 0 12px 16px; max-width: 45%; }
        .tiptap-content img.align-center { margin: 12px auto; }
        .tiptap-content img.align-full { width: 100%; margin: 12px 0; }
      `}</style>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
      <div className="tiptap-toolbar">
        <button type="button" className={`tiptap-btn ${editor.isActive('bold') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('italic') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('link') ? 'is-active' : ''}`} onClick={setLink}>Link</button>
        <button type="button" className="tiptap-btn" onClick={() => fileInputRef.current?.click()}>🖼 Image</button>
        {editor.isActive('image') && (
          <>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()}>⯇ Left</button>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()}>▬ Center</button>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()}>⯈ Right</button>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'full' }).run()}>⬛ Full</button>
          </>
        )}
        <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().undo().run()}>Undo</button>
        <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().redo().run()}>Redo</button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json components/admin/ArticleEditor.tsx
git commit -m "feat: add inline image upload (toolbar, drag-drop, paste) with alignment"
```

---

### Task 7: Wire ArticleEditor into the admin article page

**Files:**
- Modify: `app/admin/news/[id]/page.tsx`

**Interfaces:**
- Consumes: `<ArticleEditor value onChange userId>` from Task 6, `sanitizeArticleHtml` from Task 3.

- [ ] **Step 1: Replace the textarea with ArticleEditor and sanitize on save**

In `app/admin/news/[id]/page.tsx`:

Add imports near the top (after the existing imports, line 5):
```tsx
import ArticleEditor from '@/components/admin/ArticleEditor'
import { sanitizeArticleHtml } from '@/lib/content/sanitize'
```

Add a `userId` state, populated from the session, right after the existing state declarations (after line 32):
```tsx
const [userId, setUserId] = useState<string>('')

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ''))
}, [])
```

In `save()` (lines 89-113), sanitize before writing `content` into the payload — change line 96 from:
```tsx
      content,
```
to:
```tsx
      content: sanitizeArticleHtml(content),
```

Replace the content field block (lines 242-249):
```tsx
          <div className="field" style={{ marginTop: 20 }}>
            <label>Content (Markdown)</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your article here… or click Generate Report above."
            />
          </div>
```
with:
```tsx
          <div className="field" style={{ marginTop: 20 }}>
            <label>Content</label>
            {userId && <ArticleEditor value={content} onChange={setContent} userId={userId} />}
          </div>
```

- [ ] **Step 2: Manually verify in the dev server**

Run: `npm run dev`, sign in as an admin, open `/admin/news/new`, confirm the rich text toolbar renders in place of the old textarea, type some text, click the image button, pick a file, and confirm it appears inline with alignment buttons showing. Save as draft and confirm `content` in the `articles` table (via Supabase Studio) contains sanitized HTML.

- [ ] **Step 3: Commit**

```bash
git add app/admin/news/\[id\]/page.tsx
git commit -m "feat: replace markdown textarea with rich text editor in article admin page"
```

---

### Task 8: Featured image uploader on the admin article page

**Files:**
- Modify: `app/admin/news/[id]/page.tsx`

**Interfaces:**
- Consumes: `resizeImageFile` (Task 2), `uploadNewsImage` (Task 4).
- Produces: `featured_image_url`, `featured_image_alt` fields included in the save payload — consumed by Task 12/13's rendering.

- [ ] **Step 1: Add state, load, and save wiring**

Add imports (alongside Task 7's imports):
```tsx
import { resizeImageFile } from '@/lib/images/resize'
import { uploadNewsImage } from '@/lib/supabase/storage'
```

Add state after the existing `publishedAt` state (after line 27):
```tsx
const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null)
const [featuredImageAlt, setFeaturedImageAlt] = useState('')
const [uploadingFeatured, setUploadingFeatured] = useState(false)
```

In the load effect (lines 44-63), inside the `.then(({ data }) => { ... })` block, after line 59 (`setPublishedAt(...)`), add:
```tsx
          setFeaturedImageUrl(data.featured_image_url ?? null)
          setFeaturedImageAlt(data.featured_image_alt ?? '')
```

Add an upload handler after `handleTitleChange` (after line 68):
```tsx
const onPickFeaturedImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file || !userId) return
  setUploadingFeatured(true)
  try {
    const blob = await resizeImageFile(file)
    const { url, error } = await uploadNewsImage(supabase, blob, userId, 'jpg')
    if (error || !url) { setSaveMsg(`Featured image upload failed: ${error}`); return }
    setFeaturedImageUrl(url)
  } catch (err) {
    setSaveMsg(err instanceof Error ? err.message : 'Featured image processing failed.')
  } finally {
    setUploadingFeatured(false)
  }
}
```

In `save()`, add the two fields to `payload` (alongside `content:` from Task 7):
```tsx
      featured_image_url: featuredImageUrl,
      featured_image_alt: featuredImageAlt.trim() || null,
```

- [ ] **Step 2: Add the uploader UI**

Insert before the "Content" field block added in Task 7 (i.e. right after the `match-row` div closes, before `<div className="field" style={{ marginTop: 20 }}>`):
```tsx
          <div className="field">
            <label>Featured Image (optional)</label>
            {featuredImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featuredImageUrl} alt={featuredImageAlt} style={{ maxWidth: 320, borderRadius: 8, marginBottom: 10, display: 'block' }} />
            )}
            <input type="file" accept="image/*" onChange={onPickFeaturedImage} disabled={uploadingFeatured} />
            {uploadingFeatured && <div className="save-msg">Uploading…</div>}
            {featuredImageUrl && (
              <input
                style={{ marginTop: 10 }}
                value={featuredImageAlt}
                onChange={e => setFeaturedImageAlt(e.target.value)}
                placeholder="Alt text (for accessibility & SEO)"
              />
            )}
          </div>
```

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`, open `/admin/news/new`, upload a featured image, confirm a preview appears and the alt-text input shows, fill it in, save as draft, and confirm `featured_image_url`/`featured_image_alt` are populated in the `articles` row.

- [ ] **Step 4: Commit**

```bash
git add app/admin/news/\[id\]/page.tsx
git commit -m "feat: add featured image upload to article admin page"
```

---

### Task 9: Category and meta description fields

**Files:**
- Modify: `app/admin/news/[id]/page.tsx`

**Interfaces:**
- Consumes: `ARTICLE_CATEGORIES` from `lib/content/categories.ts` (Task 1).
- Produces: `category`, `meta_description` fields in the save payload — consumed by Tasks 10, 11, 12, 13.

- [ ] **Step 1: Add state, load, save, and UI**

Add import:
```tsx
import { ARTICLE_CATEGORIES } from '@/lib/content/categories'
```

Add state after `featuredImageAlt` state:
```tsx
const [category, setCategory] = useState('general')
const [metaDescription, setMetaDescription] = useState('')
```

In the load effect, alongside `setFeaturedImageAlt`:
```tsx
          setCategory(data.category ?? 'general')
          setMetaDescription(data.meta_description ?? '')
```

In `save()`, add to `payload`:
```tsx
      category,
      meta_description: metaDescription.trim() || null,
```

Add UI inside the existing `.two-col` div (after the Excerpt field, before it closes at line 219), as a new two-col row below it:
```tsx
          <div className="two-col" style={{ marginTop: 20 }}>
            <div className="field">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {ARTICLE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Meta Description ({metaDescription.length}/155)</label>
              <input
                value={metaDescription}
                onChange={e => setMetaDescription(e.target.value.slice(0, 155))}
                placeholder="Short summary for search engines & link previews…"
              />
            </div>
          </div>
```

- [ ] **Step 2: Manually verify in the dev server**

Run: `npm run dev`, open `/admin/news/new`, confirm the category dropdown lists all 5 options and the meta description field enforces the 155-char counter, save, and confirm both columns are populated in Supabase.

- [ ] **Step 3: Commit**

```bash
git add app/admin/news/\[id\]/page.tsx
git commit -m "feat: add category and meta description fields to article admin page"
```

---

### Task 10: Explicit Draft / Publish Now / Schedule controls

**Files:**
- Modify: `app/admin/news/[id]/page.tsx`

**Interfaces:**
- Produces: `published_at` written as `null` (draft), `now()` (publish now), or a future ISO string (scheduled) — consumed by Task 11's status badge logic.

- [ ] **Step 1: Add a schedule-picker state and replace the publish button**

Add state after `metaDescription`:
```tsx
const [scheduleAt, setScheduleAt] = useState('')
const [showScheduler, setShowScheduler] = useState(false)
```

Replace `save` to accept an explicit mode instead of a boolean. Change the signature and body (lines 89-113) from `const save = async (publish: boolean) => {` to:
```tsx
const save = async (mode: 'draft' | 'publish' | 'schedule') => {
  setSaving(true)
  setSaveMsg('')
  const now = new Date().toISOString()
  const nextPublishedAt =
    mode === 'draft' ? null :
    mode === 'publish' ? now :
    scheduleAt ? new Date(scheduleAt).toISOString() : null
  const payload = {
    title: title.trim(),
    slug: slug.trim() || slugify(title.trim()),
    content: sanitizeArticleHtml(content),
    excerpt: excerpt.trim() || null,
    match_id: matchId || null,
    featured_image_url: featuredImageUrl,
    featured_image_alt: featuredImageAlt.trim() || null,
    category,
    meta_description: metaDescription.trim() || null,
    published_at: nextPublishedAt,
    updated_at: now,
  }
  if (isNew) {
    const { data, error } = await supabase.from('articles').insert(payload).select('id').single()
    if (error) { setSaveMsg('Error: ' + error.message); setSaving(false); return }
    router.replace(`/admin/news/${data.id}`)
  } else {
    const { error } = await supabase.from('articles').update(payload).eq('id', params.id as string)
    if (error) { setSaveMsg('Error: ' + error.message); setSaving(false); return }
    setPublishedAt(nextPublishedAt)
  }
  setSaveMsg(mode === 'draft' ? 'Draft saved.' : mode === 'publish' ? 'Published!' : 'Scheduled!')
  setSaving(false)
  setShowScheduler(false)
}
```

Replace the `editor-actions` div (lines 183-190):
```tsx
            <div className="editor-actions">
              <button className="btn btn-outline" onClick={() => save('draft')} disabled={saving}>
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowScheduler(s => !s)} disabled={saving}>
                Schedule…
              </button>
              <button className="btn btn-primary" onClick={() => save('publish')} disabled={saving}>
                {publishedAt ? 'Update & Publish Now' : 'Publish Now'}
              </button>
            </div>
```

Add the scheduler popover UI immediately after the `editor-header` div closes (after line 191):
```tsx
          {showScheduler && (
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Publish at</label>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={e => setScheduleAt(e.target.value)}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 10 }}
                disabled={!scheduleAt || saving}
                onClick={() => save('schedule')}
              >
                Confirm Schedule
              </button>
            </div>
          )}
```

- [ ] **Step 2: Manually verify in the dev server**

Run: `npm run dev`, open an article, click "Schedule…", pick a future date/time, confirm, and check in Supabase that `published_at` is set to that future timestamp (not `null`, not now). Confirm the public `/news` list does NOT show it (RLS filters on `published_at <= now()`).

- [ ] **Step 3: Commit**

```bash
git add app/admin/news/\[id\]/page.tsx
git commit -m "feat: add explicit draft/publish-now/schedule controls to article admin page"
```

---

### Task 11: Admin list page — three-state badge and category column

**Files:**
- Modify: `app/admin/news/page.tsx`

**Interfaces:**
- Consumes: `categoryLabel` from `lib/content/categories.ts` (Task 1).

- [ ] **Step 1: Extend the query and type**

Change the `Article` type (lines 7-14) to add the two new fields:
```tsx
type Article = {
  id: string
  title: string
  slug: string
  published_at: string | null
  created_at: string
  match_id: string | null
  category: string | null
}
```

Change the select in the query effect (line 23):
```tsx
      .select('id, title, slug, published_at, created_at, match_id, category')
```

- [ ] **Step 2: Add a status helper and use it in the row**

Add import:
```tsx
import { categoryLabel } from '@/lib/content/categories'
```

Add a helper function after `togglePublish` (after line 42):
```tsx
function articleStatus(article: Article): 'draft' | 'scheduled' | 'published' {
  if (!article.published_at) return 'draft'
  return new Date(article.published_at) > new Date() ? 'scheduled' : 'published'
}
```

Replace the badge markup (lines 139-141):
```tsx
                      <span className={a.published_at ? 'badge-published' : 'badge-draft'}>
                        {a.published_at ? 'Published' : 'Draft'}
                      </span>
```
with:
```tsx
                      <span className={
                        articleStatus(a) === 'published' ? 'badge-published' :
                        articleStatus(a) === 'scheduled' ? 'badge-scheduled' : 'badge-draft'
                      }>
                        {articleStatus(a) === 'published' ? 'Published' : articleStatus(a) === 'scheduled' ? 'Scheduled' : 'Draft'}
                      </span>
                      &nbsp;·&nbsp;
                      {categoryLabel(a.category)}
```

Add a `.badge-scheduled` style next to `.badge-draft` (after line 111):
```tsx
        .badge-scheduled {
          font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          padding: 2px 7px; border-radius: 4px;
          background: rgba(56,189,248,0.1); color: #38bdf8;
          border: 1px solid rgba(56,189,248,0.2);
        }
```

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`, open `/admin/news`, confirm a scheduled article (from Task 10) shows a "Scheduled" badge and its category label, while drafts/published articles show correctly too.

- [ ] **Step 4: Commit**

```bash
git add app/admin/news/page.tsx
git commit -m "feat: show draft/scheduled/published status and category on admin news list"
```

---

### Task 12: Public news list — featured image, category badge, filter

**Files:**
- Modify: `app/(public)/news/page.tsx`

**Interfaces:**
- Consumes: `ARTICLE_CATEGORIES`, `categoryLabel` from `lib/content/categories.ts` (Task 1).

- [ ] **Step 1: Extend the query**

Change `getArticles()` (lines 6-14) select to include the new columns:
```tsx
async function getArticles() {
  const { data } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, published_at, match_id, featured_image_url, featured_image_alt, category')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
  return data ?? []
}
```

- [ ] **Step 2: Render the featured image and category badge on each card**

Add import at the top:
```tsx
import Image from 'next/image'
import { categoryLabel } from '@/lib/content/categories'
```

Replace the card body (lines 119-128):
```tsx
              {articles.map((a: any) => (
                <Link key={a.id} href={`/news/${a.slug}`} className="article-card">
                  {a.featured_image_url && (
                    <div className="article-card-image">
                      <Image
                        src={a.featured_image_url}
                        alt={a.featured_image_alt ?? a.title}
                        width={400}
                        height={220}
                        style={{ width: '100%', height: 180, objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  <div className="article-card-body">
                    <div className="article-card-date">
                      {formatDate(a.published_at)} &nbsp;·&nbsp; {categoryLabel(a.category)}
                    </div>
                    <div className="article-card-title">{a.title}</div>
                    {a.excerpt && <div className="article-card-excerpt">{a.excerpt}</div>}
                  </div>
                  <div className="article-card-footer">Read more →</div>
                </Link>
              ))}
```

This feature this-page is a server component with no interactivity, so a real filter dropdown (which needs client state) is added as a small client component. Create `app/(public)/news/CategoryFilter.tsx`:
```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ARTICLE_CATEGORIES } from '@/lib/content/categories'

export default function CategoryFilter() {
  const router = useRouter()
  const params = useSearchParams()
  const current = params.get('category') ?? ''

  return (
    <select
      className="category-filter"
      value={current}
      onChange={e => {
        const value = e.target.value
        router.push(value ? `/news?category=${value}` : '/news')
      }}
    >
      <option value="">All categories</option>
      {ARTICLE_CATEGORIES.map(c => (
        <option key={c.value} value={c.value}>{c.label}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 3: Wire the filter into the page**

Change `getArticles` to accept an optional category and filter server-side:
```tsx
async function getArticles(category?: string) {
  let query = supabase
    .from('articles')
    .select('id, title, slug, excerpt, published_at, match_id, featured_image_url, featured_image_alt, category')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
  if (category) query = query.eq('category', category)
  const { data } = await query
  return data ?? []
}
```

Change the page component signature and call site:
```tsx
export default async function NewsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams
  const articles = await getArticles(category)
```

Note: reading `searchParams` makes this page render dynamically per-request instead of using the `revalidate = 60` ISR cache (Next.js opts out of static rendering whenever a page reads `searchParams`). Acceptable trade-off for a low-traffic club news filter — flagging it as a conscious choice, not an oversight.

Add the filter and import into the hero section, right after the `.news-hero-sub` div closes:
```tsx
            <CategoryFilter />
```
```tsx
import CategoryFilter from './CategoryFilter'
```

Add CSS for `.article-card-image` and `.category-filter` in the existing `<style>` block:
```css
        .article-card-image { overflow: hidden; }
        .category-filter {
          margin-top: 16px;
          background: rgba(10,22,40,0.6);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 8px; padding: 8px 14px;
          color: #e2eeff; font-family: 'Outfit', sans-serif; font-size: 13px;
        }
        .category-filter option { background: #050c1a; }
```

- [ ] **Step 4: Manually verify in the dev server**

Run: `npm run dev`, open `/news`, confirm featured images and category text show on cards, select a category from the dropdown, and confirm the URL updates to `/news?category=...` and the list filters correctly.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/news/page.tsx" "app/(public)/news/CategoryFilter.tsx"
git commit -m "feat: show featured image, category, and category filter on public news list"
```

---

### Task 13: Public article page — sanitized HTML rendering, featured image, category badge

**Files:**
- Modify: `app/(public)/news/[slug]/page.tsx`

**Interfaces:**
- Consumes: `sanitizeArticleHtml` from `lib/content/sanitize.ts` (Task 3), `categoryLabel` from `lib/content/categories.ts` (Task 1).

- [ ] **Step 1: Replace the markdown renderer with the shared sanitizer**

Remove `sanitizeHtml()`, `renderMarkdown()`, and `inline()` (lines 25-72) entirely, and add:
```tsx
import { sanitizeArticleHtml } from '@/lib/content/sanitize'
import { categoryLabel } from '@/lib/content/categories'
import Image from 'next/image'
```

Change line 79 from:
```tsx
  const html = renderMarkdown(article.content)
```
to:
```tsx
  const html = sanitizeArticleHtml(article.content)
```

- [ ] **Step 2: Render the featured image and category badge**

In the hero section, after the `.article-breadcrumb` div (after line 155) and before `.article-date`, add:
```tsx
            {article.category && (
              <div className="article-category-badge">{categoryLabel(article.category)}</div>
            )}
```

After the hero's `.container` div closes but before the body `.container` div (i.e. right after line 159, before line 161), add a full-width featured image banner:
```tsx
        {article.featured_image_url && (
          <div className="container">
            <div className="article-featured-image">
              <Image
                src={article.featured_image_url}
                alt={article.featured_image_alt ?? article.title}
                width={1200}
                height={420}
                style={{ width: '100%', height: 420, objectFit: 'cover', borderRadius: 12 }}
                priority
              />
            </div>
          </div>
        )}
```

`width`/`height` are fixed regardless of the source image's real dimensions, so `objectFit: 'cover'` is required — without it, `next/image` would stretch/distort any upload that isn't exactly a 1200:420 ratio (same reasoning as the `objectFit: 'cover'` already used for list-card thumbnails in Task 12).

Add CSS for `.article-category-badge` and `.article-featured-image` inside the existing `<style>` block:
```css
        .article-category-badge {
          display: inline-block; margin-bottom: 10px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 5px;
          background: rgba(56,189,248,0.12); color: #38bdf8;
          border: 1px solid rgba(56,189,248,0.25);
        }
        .article-featured-image { margin-bottom: 32px; overflow: hidden; border-radius: 12px; }
```

- [ ] **Step 3: Style inline images inside `.article-body`**

Add to `.article-body` rules in the existing `<style>` block:
```css
        .article-body img.article-img { max-width: 100%; border-radius: 8px; }
        .article-body img.align-left { float: left; margin: 0 20px 12px 0; max-width: 45%; }
        .article-body img.align-right { float: right; margin: 0 0 12px 20px; max-width: 45%; }
        .article-body img.align-center { display: block; margin: 20px auto; }
        .article-body img.align-full { width: 100%; margin: 20px 0; }
```

- [ ] **Step 4: Manually verify in the dev server**

Run: `npm run dev`, publish an article (from Task 10) with a featured image, a category, and inline images at different alignments, then open `/news/<slug>` and confirm: the featured image banner renders, the category badge shows, and inline images render at their chosen alignment without any raw HTML/script surviving (test by trying to save an article with a `<script>` tag pasted into the editor's HTML via devtools — confirm it's stripped on render).

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/news/[slug]/page.tsx"
git commit -m "feat: render sanitized rich content, featured image, and category on article page"
```

---

### Task 14: End-to-end test for the full authoring flow

**Files:**
- Modify: `tests/e2e/helpers/supabase-mock.ts` (extend `ARTICLE_FIXTURE`, add a storage upload mock)
- Modify: `tests/e2e/admin-news.spec.ts`

**Interfaces:**
- Consumes: `mockAllAdmin`, `mockE2eAuth` from the existing helper module (unchanged signatures).

- [ ] **Step 1: Extend the fixture and add a storage route mock**

In `tests/e2e/helpers/supabase-mock.ts`, extend `ARTICLE_FIXTURE` (lines 128-137) with the new fields:
```ts
export const ARTICLE_FIXTURE = {
  id: 'article-uuid-1',
  title: 'BCC Win the League',
  slug: 'bcc-win-the-league',
  content: 'Bedfordview Cricket Club clinched the T20 League title...',
  excerpt: 'BCC clinched the title in dramatic fashion.',
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  match_id: null,
  featured_image_url: null,
  featured_image_alt: null,
  category: 'club_news',
  meta_description: null,
}
```

Add a helper function in the same file, alongside the other `mock*` exports:
```ts
export async function mockStorageUpload(page: import('@playwright/test').Page) {
  await page.route('**/storage/v1/object/news-images/**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Key: 'news-images/fake.jpg' }) })
  })
}
```

- [ ] **Step 2: Add the new-article authoring test**

Append to `tests/e2e/admin-news.spec.ts`:
```ts
import { mockStorageUpload } from './helpers/supabase-mock'

test.describe('Admin news editor — rich content', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await mockAllAdmin(page)
    await mockStorageUpload(page)
    await page.route('**/rest/v1/articles**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ARTICLE_FIXTURE),
      })
    })
  })

  test('shows the rich text toolbar instead of a plain textarea', async ({ page }) => {
    await page.goto('/admin/news/new')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.tiptap-toolbar')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('textarea[placeholder*="markdown" i]')).toHaveCount(0)
  })

  test('shows category dropdown with all five options', async ({ page }) => {
    await page.goto('/admin/news/new')
    await page.waitForLoadState('networkidle')
    const options = page.locator('select option')
    await expect(page.locator('body')).toContainText(/match report|club news|junior section|announcement|general/i)
  })

  test('shows Save Draft, Schedule, and Publish Now actions', async ({ page }) => {
    await page.goto('/admin/news/new')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible()
    await expect(page.locator('button:has-text("Schedule")')).toBeVisible()
    await expect(page.locator('button:has-text("Publish Now")')).toBeVisible()
  })
})
```

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e -- admin-news`
Expected: PASS for the new tests (and no regressions in the existing `Admin news page` describe block).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/helpers/supabase-mock.ts tests/e2e/admin-news.spec.ts
git commit -m "test: cover rich text editor, categories, and publish controls in admin news e2e"
```

---

### Task 15: Full test suite and build verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: all tests pass, including the new ones from Tasks 1-4.

- [ ] **Step 2: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all tests pass, including `admin-news.spec.ts` and `public-content.spec.ts` (which exercises `/news`).

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no new lint errors introduced by this feature's files.
