import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'
import type { PostMeta } from '../model/schema'
import PostCard from './post-card.svelte'

expect.extend(matchers)

const post: PostMeta = {
  slug: 'ssr-i-indeksatsiya',
  title: 'SSR и индексация',
  description: 'Почему первый HTML решает всё',
  pubDate: '2026-03-03',
  updatedDate: '2026-06-05',
  cover: './covers/ssr-i-indeksatsiya.png',
  tags: ['ssr', 'seo'],
}

describe('PostCard', () => {
  it('рендерит заголовок ссылкой на пост', () => {
    render(PostCard, { props: { post, href: '/blog/ssr-i-indeksatsiya', locale: 'ru' } })
    const link = screen.getByRole('link', { name: /SSR и индексация/ })
    expect(link.getAttribute('href')).toBe('/blog/ssr-i-indeksatsiya')
  })

  it('дата выводится machine-readable в <time datetime>', () => {
    const { container } = render(PostCard, { props: { post, href: '/blog/x', locale: 'ru' } })
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe('2026-03-03')
  })

  it('нет нарушений доступности', async () => {
    const { container } = render(PostCard, { props: { post, href: '/blog/x', locale: 'ru' } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
