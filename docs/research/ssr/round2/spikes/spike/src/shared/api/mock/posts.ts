export interface MockPost {
  slug: string
  title: string
  excerpt: string
  body: string
  publishedAt: string
}

// In-memory витрина мок-API: живёт в процессе сервера, отдаётся server route'ом
// /api/v1/posts. Браузеру Service Worker больше не нужен.
export const mockPosts: Array<MockPost> = [
  {
    slug: 'ssr-i-seo',
    title: 'SSR и техническое SEO',
    excerpt: 'Почему краулеру нужен готовый HTML, а не пустой div#root.',
    body: 'Серверный рендер отдаёт разметку сразу, без ожидания гидрации.',
    publishedAt: '2026-09-01',
  },
  {
    slug: 'fsd-na-servere',
    title: 'FSD на сервере',
    excerpt: 'Слои app → pages → widgets → features → entities → shared не меняются.',
    body: 'Меняется только состав app: вместо main.tsx — router/client/server entry.',
    publishedAt: '2026-09-08',
  },
]

export function findPost(slug: string): MockPost | undefined {
  return mockPosts.find((p) => p.slug === slug)
}
