import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ArticlePreviewModal from '../ArticlePreviewModal'

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
  category: 'club_news',
  featuredImageUrl: null as string | null,
  featuredImageAlt: '',
  content: '<p>Great win for the club.</p>',
  matchId: '',
}

describe('ArticlePreviewModal', () => {
  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<ArticlePreviewModal {...baseProps} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<ArticlePreviewModal {...baseProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
