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
