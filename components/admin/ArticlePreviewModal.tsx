'use client'

import { useEffect, useRef } from 'react'
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
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

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
          ref={closeButtonRef}
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
