import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { describe, expect, it } from 'vitest'
import Hero from './hero.astro'

describe('Hero', () => {
  it('рендерится в HTML с h1 и CTA', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(Hero, { props: { locale: 'ru' } })
    expect(html).toContain('<h1')
    expect(html).toContain('Индексируемый сайт')
    expect(html).toContain('href="/blog"')
  })
})
