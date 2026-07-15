# News Article Preview & Auto-Excerpt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins preview an article exactly as it will render publicly (using live, unsaved editor state) before publishing, and auto-fill a missing excerpt on the public news list from the article's content.

**Architecture:** Extract the public article page's rendering into a standalone `ArticleView` component so it can be reused, unmodified, inside a full-screen preview overlay launched from the admin editor. Add a small pure `deriveExcerpt` helper and use it as a render-time fallback on the public news list — no new DB columns, no persisted writes.

**Tech Stack:** Next.js 15 App Router (React 19 Server + Client Components), existing `sanitizeArticleHtml` (DOMPurify), vitest + `@testing-library/react`, Playwright e2e.

## Global Constraints

- All article HTML must be passed through `sanitizeArticleHtml` (`lib/content/sanitize.ts`) before being rendered via `dangerouslySetInnerHTML` — never render raw editor content directly.
- Follow the existing design system: navy background `#050c1a`, blue accent `#2563eb`/`#3b82f6`, sky highlight `#38bdf8`, `Syne` (headings) + `Outfit` (body) fonts. Match existing inline-style conventions used in `components/scorer/*Modal.tsx` for new modal components.
- No new npm dependencies.
- Unit tests live in a `__tests__` subdirectory colocated with the source file (vitest). E2e specs live in `tests/e2e/*.spec.ts` (Playwright) and reuse fixtures/helpers from `tests/e2e/helpers/supabase-mock.ts`.
- Client components require the `'use client'` directive at the top of the file; components with no hooks/interactivity should NOT have it, so they stay usable from both server and client trees.

---

### Task 1: Extract `ArticleView` and refactor the public article page to use it

**Files:**
- Create: `components/ArticleView.tsx`
- Create: `components/__tests__/ArticleView.test.tsx`
- Modify: `app/(public)/news/[slug]/page.tsx`

**Interfaces:**
- Produces: `ArticleView` component, default export from `components/ArticleView.tsx`:
  ```ts
  type ArticleViewProps = {
    title: string
    category: string | null
    dateLabel: string
    featuredImageUrl: string | null
    featuredImageAlt: string | null
    bodyHtml: string
    matchId: string | null
  }
  ```
  Renders the hero (breadcrumb, category badge, date, headline), optional featured image, sanitized body, and optional "View full scorecard →" link — pure presentation, no data fetching, no `'use client'` directive.
- Consumes: `categoryLabel` from `@/lib/content/categories` (existing).

- [ ] **Step 1: Write the failing component test**

Create `components/__tests__/ArticleView.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ArticleView from '../ArticleView'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const baseProps = {
  title: 'BCC Win the League',
  category: null as string | null,
  dateLabel: 'Tuesday, 15 July 2026',
  featuredImageUrl: null as string | null,
  featuredImageAlt: null as string | null,
  bodyHtml: '<p>Great win for the club.</p>',
  matchId: null as string | null,
}

describe('ArticleView', () => {
  it('renders title, date, and body content', () => {
    render(<ArticleView {...baseProps} />)
    expect(screen.getByText('BCC Win the League')).toBeInTheDocument()
    expect(screen.getByText('Tuesday, 15 July 2026')).toBeInTheDocument()
    expect(screen.getByText('Great win for the club.')).toBeInTheDocument()
  })

  it('shows the category badge when category is set', () => {
    render(<ArticleView {...baseProps} category="club_news" />)
    expect(screen.getByText('Club News')).toBeInTheDocument()
  })

  it('omits the category badge when category is null', () => {
    render(<ArticleView {...baseProps} category={null} />)
    expect(screen.queryByText('Club News')).not.toBeInTheDocument()
  })

  it('renders the featured image when a URL is set', () => {
    render(
      <ArticleView
        {...baseProps}
        featuredImageUrl="https://x.supabase.co/img.jpg"
        featuredImageAlt="Team photo"
      />
    )
    expect(screen.getByAltText('Team photo')).toBeInTheDocument()
  })

  it('omits the featured image when no URL is set', () => {
    render(<ArticleView {...baseProps} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows a scorecard link when a matchId is set', () => {
    render(<ArticleView {...baseProps} matchId="match-uuid-1" />)
    const link = screen.getByText('View full scorecard →')
    expect(link.closest('a')).toHaveAttribute('href', '/results/match-uuid-1')
  })

  it('omits the scorecard link when matchId is null', () => {
    render(<ArticleView {...baseProps} />)
    expect(screen.queryByText('View full scorecard →')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/__tests__/ArticleView.test.tsx`
Expected: FAIL — `Cannot find module '../ArticleView'` (file doesn't exist yet).

- [ ] **Step 3: Create `components/ArticleView.tsx`**

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { categoryLabel } from '@/lib/content/categories'

type ArticleViewProps = {
  title: string
  category: string | null
  dateLabel: string
  featuredImageUrl: string | null
  featuredImageAlt: string | null
  bodyHtml: string
  matchId: string | null
}

export default function ArticleView({
  title,
  category,
  dateLabel,
  featuredImageUrl,
  featuredImageAlt,
  bodyHtml,
  matchId,
}: ArticleViewProps) {
  return (
    <>
      <style>{`
        .article-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; max-width: 100vw; overflow-x: hidden; }
        .article-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid rgba(59,130,246,0.15);
          padding: 44px 0 36px;
          margin-bottom: 40px;
        }
        .article-breadcrumb {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
          margin-bottom: 14px;
          display: flex; align-items: center; gap: 8px;
        }
        .article-breadcrumb a { color: #60a5fa; text-decoration: none; }
        .article-breadcrumb a:hover { color: #93c5fd; }
        .article-category-badge {
          display: inline-block; margin-bottom: 10px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 5px;
          background: rgba(56,189,248,0.12); color: #38bdf8;
          border: 1px solid rgba(56,189,248,0.25);
        }
        .article-featured-image { margin-bottom: 32px; overflow: hidden; border-radius: 12px; }
        .article-date {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
          margin-bottom: 12px;
        }
        .article-headline {
          font-family: 'Syne', sans-serif;
          font-size: clamp(26px, 4vw, 44px);
          font-weight: 800; color: #f0f8ff;
          letter-spacing: -0.02em; line-height: 1.15;
          margin-bottom: 12px;
        }
        .article-body {
          max-width: 680px;
          font-family: 'Outfit', sans-serif;
          font-size: 16px; line-height: 1.8;
          color: rgba(147,197,253,0.8);
        }
        .article-body p { margin: 0 0 1.4em 0; }
        .article-body h1, .article-body h2, .article-body h3 {
          font-family: 'Syne', sans-serif;
          color: #e2eeff; letter-spacing: -0.01em;
          margin: 1.8em 0 0.6em;
        }
        .article-body h2 { font-size: 22px; font-weight: 800; }
        .article-body h3 { font-size: 18px; font-weight: 700; }
        .article-body strong { color: #e2eeff; font-weight: 700; }
        .article-body em { color: #93c5fd; font-style: italic; }
        .article-body img.article-img { max-width: 100%; border-radius: 8px; }
        .article-body img.align-left { float: left; margin: 0 20px 12px 0; max-width: 45%; }
        .article-body img.align-right { float: right; margin: 0 0 12px 20px; max-width: 45%; }
        .article-body img.align-center { display: block; margin: 20px auto; }
        .article-body img.align-full { width: 100%; margin: 20px 0; }
        .article-match-link {
          display: inline-flex; align-items: center; gap: 8px;
          margin-top: 32px;
          padding: 10px 18px; border-radius: 8px;
          background: rgba(37,99,235,0.08);
          border: 1px solid rgba(59,130,246,0.25);
          color: #60a5fa;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;
          text-decoration: none; transition: all 0.15s;
        }
        .article-match-link:hover { background: rgba(37,99,235,0.18); border-color: rgba(59,130,246,0.45); }
        @media (max-width: 768px) {
          .article-body { font-size: 15px; }
          .article-hero { padding: 32px 0 28px; margin-bottom: 28px; }
        }
      `}</style>

      <div className="article-page">
        <div className="article-hero">
          <div className="container">
            <div className="article-breadcrumb">
              <Link href="/news">News</Link>
              <span>/</span>
              Article
            </div>
            {category && (
              <div className="article-category-badge">{categoryLabel(category)}</div>
            )}
            <div className="article-date">{dateLabel}</div>
            <div className="article-headline">{title}</div>
          </div>
        </div>

        {featuredImageUrl && (
          <div className="container">
            <div className="article-featured-image">
              <Image
                src={featuredImageUrl}
                alt={featuredImageAlt ?? title}
                width={1200}
                height={420}
                style={{ width: '100%', height: 420, objectFit: 'cover', borderRadius: 12 }}
                priority
              />
            </div>
          </div>
        )}

        <div className="container">
          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
          {matchId && (
            <Link href={`/results/${matchId}`} className="article-match-link">
              View full scorecard →
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/__tests__/ArticleView.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Refactor the public article page to use `ArticleView`**

Replace the full contents of `app/(public)/news/[slug]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import { anonSupabase as supabase } from '@/lib/supabase/server'
import { sanitizeArticleHtml } from '@/lib/content/sanitize'
import ArticleView from '@/components/ArticleView'

export const revalidate = 60

async function getArticle(slug: string) {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .single()
  if (error) return null
  return data
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()

  return (
    <ArticleView
      title={article.title}
      category={article.category}
      dateLabel={formatDate(article.published_at)}
      featuredImageUrl={article.featured_image_url}
      featuredImageAlt={article.featured_image_alt}
      bodyHtml={sanitizeArticleHtml(article.content)}
      matchId={article.match_id}
    />
  )
}
```

- [ ] **Step 6: Verify the existing public article e2e test still passes**

Run: `npx playwright test tests/e2e/public-content.spec.ts -g "News article page"`
Expected: PASS — `loads article page without error` still succeeds against the refactored page.

- [ ] **Step 7: Commit**

```bash
git add components/ArticleView.tsx components/__tests__/ArticleView.test.tsx "app/(public)/news/[slug]/page.tsx"
git commit -m "refactor: extract ArticleView component from public article page"
```

---

### Task 2: Add `ArticlePreviewModal` and wire a Preview button into the admin editor

**Files:**
- Create: `components/admin/ArticlePreviewModal.tsx`
- Modify: `app/admin/news/[id]/page.tsx`
- Modify: `tests/e2e/admin-news.spec.ts`

**Interfaces:**
- Consumes: `ArticleView` from `@/components/ArticleView` (Task 1), `sanitizeArticleHtml` from `@/lib/content/sanitize` (existing).
- Produces: `ArticlePreviewModal`, default export from `components/admin/ArticlePreviewModal.tsx`:
  ```ts
  type ArticlePreviewModalProps = {
    title: string
    category: string
    featuredImageUrl: string | null
    featuredImageAlt: string
    content: string
    matchId: string
    onClose: () => void
  }
  ```

- [ ] **Step 1: Write the failing e2e test**

In `tests/e2e/admin-news.spec.ts`, inside the existing `test.describe('Admin news editor — rich content', ...)` block (after the last test, before its closing `})`), add:

```ts
  test('Preview shows the current draft as it would appear publicly', async ({ page }) => {
    await page.goto('/admin/news/new')
    await page.waitForLoadState('networkidle')

    await page.fill('input[placeholder="Article title…"]', 'Preview Test Title')
    await page.locator('.ProseMirror').click()
    await page.locator('.ProseMirror').fill('Preview body content.')

    await page.click('button:has-text("Preview")')
    await expect(page.getByText(/preview.*not saved or published/i)).toBeVisible()
    await expect(page.getByText('Preview Test Title')).toBeVisible()
    await expect(page.getByText('Preview body content.')).toBeVisible()

    await page.click('button[aria-label="Close preview"]')
    await expect(page.locator('input[value="Preview Test Title"]')).toBeVisible()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/e2e/admin-news.spec.ts -g "Preview shows the current draft"`
Expected: FAIL — no element matches `button:has-text("Preview")`.

- [ ] **Step 3: Create `components/admin/ArticlePreviewModal.tsx`**

```tsx
'use client'

import { sanitizeArticleHtml } from '@/lib/content/sanitize'
import ArticleView from '@/components/ArticleView'

type ArticlePreviewModalProps = {
  title: string
  category: string
  featuredImageUrl: string | null
  featuredImageAlt: string
  content: string
  matchId: string
  onClose: () => void
}

function formatPreviewDate(d: Date) {
  return d.toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function ArticlePreviewModal({
  title,
  category,
  featuredImageUrl,
  featuredImageAlt,
  content,
  matchId,
  onClose,
}: ArticlePreviewModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050c1a', zIndex: 300, overflowY: 'auto' }}>
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 301,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'rgba(37,99,235,0.95)',
          borderBottom: '1px solid rgba(59,130,246,0.4)',
          fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 700,
          color: '#f0f8ff', letterSpacing: '0.05em', textTransform: 'uppercase',
        }}
      >
        <span>Preview — not saved or published</span>
        <button
          aria-label="Close preview"
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6,
            color: '#f0f8ff', fontSize: 13, fontWeight: 700, padding: '6px 12px', cursor: 'pointer',
            textTransform: 'none', letterSpacing: 'normal',
          }}
        >
          × Close Preview
        </button>
      </div>
      <ArticleView
        title={title}
        category={category || null}
        dateLabel={formatPreviewDate(new Date())}
        featuredImageUrl={featuredImageUrl}
        featuredImageAlt={featuredImageAlt || null}
        bodyHtml={sanitizeArticleHtml(content)}
        matchId={matchId || null}
      />
    </div>
  )
}
```

- [ ] **Step 4: Wire the Preview button and modal into the editor**

In `app/admin/news/[id]/page.tsx`:

Add the import after the existing `ARTICLE_CATEGORIES` import (line 10):

```tsx
import { ARTICLE_CATEGORIES } from '@/lib/content/categories'
import ArticlePreviewModal from '@/components/admin/ArticlePreviewModal'
```

Add preview state after the `showScheduler` state declaration (line 58):

```tsx
  const [showScheduler, setShowScheduler] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
```

Add the Preview button inside `.editor-actions`, right after the Save Draft button (after line 263's closing `</button>`, before the Schedule button):

```tsx
              <button className="btn btn-outline" onClick={() => save('draft')} disabled={saving || uploadingFeatured}>
                {saving ? 'Saving…' : uploadingFeatured ? 'Uploading image…' : 'Save Draft'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowPreview(true)} disabled={saving || uploadingFeatured}>
                Preview
              </button>
```

Render the modal right after `.article-editor`'s closing `</div>` (after line 399, before the fragment's closing `</>` on line 400):

```tsx
        </div>
      </div>

      {showPreview && (
        <ArticlePreviewModal
          title={title}
          category={category}
          featuredImageUrl={featuredImageUrl}
          featuredImageAlt={featuredImageAlt}
          content={content}
          matchId={matchId}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test tests/e2e/admin-news.spec.ts -g "Preview shows the current draft"`
Expected: PASS.

- [ ] **Step 6: Run the full admin news e2e file to check for regressions**

Run: `npx playwright test tests/e2e/admin-news.spec.ts`
Expected: PASS (all tests, including the 3 pre-existing "rich content" tests).

- [ ] **Step 7: Commit**

```bash
git add components/admin/ArticlePreviewModal.tsx "app/admin/news/[id]/page.tsx" tests/e2e/admin-news.spec.ts
git commit -m "feat: add live article preview to the admin news editor"
```

---

### Task 3: `deriveExcerpt` helper

**Files:**
- Create: `lib/content/excerpt.ts`
- Create: `lib/content/__tests__/excerpt.test.ts`

**Interfaces:**
- Produces: `deriveExcerpt(html: string, maxLen?: number): string`, default `maxLen` of 155.

- [ ] **Step 1: Write the failing test**

Create `lib/content/__tests__/excerpt.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/content/__tests__/excerpt.test.ts`
Expected: FAIL — `Cannot find module '../excerpt'`.

- [ ] **Step 3: Create `lib/content/excerpt.ts`**

```ts
export function deriveExcerpt(html: string, maxLen = 155): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= maxLen) return text

  const truncated = text.slice(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  const cut = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated
  return `${cut}…`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/content/__tests__/excerpt.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/content/excerpt.ts lib/content/__tests__/excerpt.test.ts
git commit -m "feat: add deriveExcerpt helper for auto-generated article excerpts"
```

---

### Task 4: Auto-fill missing excerpts on the public news list page

**Files:**
- Modify: `app/(public)/news/page.tsx`
- Modify: `tests/e2e/public-content.spec.ts`

**Interfaces:**
- Consumes: `deriveExcerpt` from `@/lib/content/excerpt` (Task 3).

- [ ] **Step 1: Write the failing e2e test**

In `tests/e2e/public-content.spec.ts`, inside `test.describe('News page', ...)` (after the last test, before its closing `})`), add:

```ts
  test('shows a derived excerpt when the article has none', async ({ page }) => {
    const noExcerptArticle = {
      ...ARTICLE_FIXTURE,
      excerpt: '',
      content: 'Bedfordview thrashed the visitors in a one-sided contest that fans will remember for years.',
    }
    await page.route('**/rest/v1/articles**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([noExcerptArticle]),
      })
    })
    await page.goto('/news')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.article-card-excerpt')).toContainText(/Bedfordview thrashed the visitors/i)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/e2e/public-content.spec.ts -g "shows a derived excerpt"`
Expected: FAIL — `.article-card-excerpt` is not rendered because `excerpt` is empty and there's no fallback yet.

- [ ] **Step 3: Update `app/(public)/news/page.tsx`**

Add the import after the `categoryLabel` import (line 4):

```tsx
import { categoryLabel } from '@/lib/content/categories'
import { deriveExcerpt } from '@/lib/content/excerpt'
```

Add `content` to the `select()` column list (line 12):

```tsx
    .select('id, title, slug, excerpt, content, published_at, match_id, featured_image_url, featured_image_alt, category')
```

Replace the `articles.map(...)` block (lines 135-157) with:

```tsx
              {articles.map((a: any) => {
                const excerptText = a.excerpt?.trim() || deriveExcerpt(a.content)
                return (
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
                      {excerptText && <div className="article-card-excerpt">{excerptText}</div>}
                    </div>
                    <div className="article-card-footer">Read more →</div>
                  </Link>
                )
              })}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/e2e/public-content.spec.ts -g "shows a derived excerpt"`
Expected: PASS.

- [ ] **Step 5: Run the full news-page e2e tests to check for regressions**

Run: `npx playwright test tests/e2e/public-content.spec.ts -g "News page"`
Expected: PASS (all tests, including the 3 pre-existing "News page" tests).

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/news/page.tsx" tests/e2e/public-content.spec.ts
git commit -m "feat: auto-generate excerpt from content when none is set"
```

---

## Post-plan verification

- [ ] Run the full unit test suite: `npm test` — expect all tests passing, including the 4 new `ArticleView` + `deriveExcerpt` test groups.
- [ ] Run the full e2e suite for the touched files: `npx playwright test tests/e2e/admin-news.spec.ts tests/e2e/public-content.spec.ts` — expect all passing.
