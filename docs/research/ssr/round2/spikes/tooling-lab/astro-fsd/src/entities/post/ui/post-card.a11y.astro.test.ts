import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import axe from 'axe-core'
import { Window } from 'happy-dom'
import { expect, test } from 'vitest'
import PostCard from './post-card.astro'

test('нет нарушений доступности', async () => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(PostCard, { props: { title: 'Пост', href: '/blog/post' } })

  const window = new Window({ url: 'https://example.com' })
  window.document.body.innerHTML = html
  // axe работает с глобальными window/document
  const g = globalThis as unknown as { window: unknown; document: unknown }
  g.window = window
  g.document = window.document
  // фрагмент вне <main>: правило region к изолированному компоненту неприменимо
  const results = await axe.run(window.document.body as unknown as Element, {
    rules: { region: { enabled: false } },
  })
  expect(results.violations).toEqual([])
}, 20000)
