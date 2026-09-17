import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Post } from '../model/schema'
import { PostCard } from './post-card'

const post: Post = {
  title: 'Заголовок',
  description: 'Описание',
  pubDate: '2026-01-02',
  updatedDate: '2026-01-03',
  cover: '/covers/x.png',
  tags: ['seo'],
  slug: 'zagolovok',
  html: '<p>тело</p>',
  readingMinutes: 3,
}

describe('PostCard (server component)', () => {
  it('ru: ссылка без префикса локали', () => {
    const html = renderToStaticMarkup(<PostCard post={post} locale="ru" />)
    expect(html).toContain('href="/blog/zagolovok"')
    expect(html).toContain('Заголовок')
  })

  it('en: ссылка с префиксом', () => {
    const html = renderToStaticMarkup(<PostCard post={post} locale="en" />)
    expect(html).toContain('href="/en/blog/zagolovok"')
  })

  it('картинка получает srcset оптимизатора и lazy', () => {
    const html = renderToStaticMarkup(<PostCard post={post} locale="ru" />)
    expect(html).toMatch(/srcset="[^"]*\/_next\/image\?url=%2Fcovers%2Fx\.png/i)
    expect(html).toContain('loading="lazy"')
  })
})
