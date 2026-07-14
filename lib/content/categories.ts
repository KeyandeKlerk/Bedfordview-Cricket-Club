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
