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
