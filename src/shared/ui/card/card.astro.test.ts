import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import Card from './card.astro'

const astro = await AstroContainer.create()

// Карточка — пункт списка: тест ставит её в <ul>, как блок.
async function render() {
  const card = await astro.renderToString(Card, {
    props: { title: 'Рендер' },
    slots: { default: '<p>Страницы готовы до первого запроса.</p>' },
  })
  const html = `<ul>${card}</ul>`
  return { html, item: parseHtml(html).querySelector('ul > li') }
}

describe('Card', () => {
  it('пункт списка: заголовок карточки уровня 3, под ним — содержимое', async () => {
    const { item } = await render()
    expect(item?.querySelector('h3')?.textContent).toBe('Рендер')
    expect(item?.querySelector('h3 + * p')?.textContent).toBe('Страницы готовы до первого запроса.')
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
