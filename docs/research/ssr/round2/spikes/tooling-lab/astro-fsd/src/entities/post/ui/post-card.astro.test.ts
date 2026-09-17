import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expect, test } from 'vitest'
import PostCard from './post-card.astro'

test('рендерит заголовок и ссылку', async () => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(PostCard, {
    props: { title: 'Пост', href: '/blog/post' },
  })
  expect(html).toContain('Пост')
  expect(html).toContain('href="/blog/post"')
})
