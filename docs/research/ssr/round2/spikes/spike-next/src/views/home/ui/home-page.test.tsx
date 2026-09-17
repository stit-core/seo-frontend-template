import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePage } from './home-page'

// async RSC не рендерится renderToStaticMarkup напрямую: вызываем как функцию,
// ждём промис и рендерим уже готовое дерево.
describe('HomePage (async RSC)', () => {
  it('содержит h1 и три последних поста', async () => {
    const tree = await HomePage({ locale: 'ru' })
    const html = renderToStaticMarkup(tree)
    expect(html).toContain('<h1')
    expect((html.match(/<article/g) ?? []).length).toBe(3)
    expect(html).toContain('application/ld+json')
  })
})
