import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import MotionToggle from './motion-toggle.astro'

const container = await AstroContainer.create()

async function render(props: Record<string, unknown> = { locale: 'ru' }) {
  const html = await container.renderToString(MotionToggle, { props })
  const group = parseHtml(html).querySelector('fieldset')
  const label = group?.ownerDocument.getElementById(group.getAttribute('aria-labelledby') ?? '')
  return {
    html,
    group,
    label: label?.textContent?.trim(),
    buttons: [...(group?.querySelectorAll('button') ?? [])],
  }
}

describe('MotionToggle', () => {
  it('группа подписана видимым словом, три кнопки — значения data-motion по контракту базы', async () => {
    const { html, label, buttons } = await render()
    expect(label).toBe('Движение')
    expect(buttons.map((button) => button.getAttribute('type'))).toEqual([
      'button',
      'button',
      'button',
    ])
    // Значение — атрибут `data-motion-set` контракта базы strategy: по нему кнопку узнают остров и ворота.
    // Пустое — «как в системе»: атрибута на <html> нет.
    expect(buttons.map((button) => button.getAttribute('data-motion-set'))).toEqual([
      '',
      'reduced',
      'full',
    ])
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Как в системе',
      'Меньше',
      'Полное',
    ])
    expect(html).not.toContain('<script')
  })

  // Выбор посетителя сервер не знает: состояние объявляет остров, и до него группа скрыта.
  it('состояние в разметке не объявлено', async () => {
    expect((await render()).group?.querySelector('[aria-pressed]')).toBeNull()
  })

  it('подписи переводятся', async () => {
    const { label, buttons } = await render({ locale: 'en' })
    expect(label).toBe('Motion')
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'System',
      'Reduced',
      'Full',
    ])
  })

  it('класс страницы — рядом со своими', async () => {
    const own = [...((await render()).group?.classList ?? [])]
    const placed = [...((await render({ locale: 'ru', class: 'mt-md' })).group?.classList ?? [])]
    expect(placed).toEqual([...own, 'mt-md'])
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
