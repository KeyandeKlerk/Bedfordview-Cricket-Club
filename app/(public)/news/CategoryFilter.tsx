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
