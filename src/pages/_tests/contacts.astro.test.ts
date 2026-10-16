import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { DEFAULT_LOCALE } from '@/shared/i18n'
import ContactsPage from '../_contacts/contacts-page.astro'

// План контактов без политики ПДн: правовое плана снято, прочие данные страницы — сайта.
vi.mock('virtual:strategy/contacts', async (importOriginal) => {
  const { default: files } = await importOriginal<{ default: Record<string, unknown> }>()
  return {
    default: Object.fromEntries(
      Object.entries(files).map(([path, data]) => {
        if (!path.includes('/plans/')) return [path, data]
        const plan = data as { page: Record<string, unknown> }
        return [path, { ...plan, page: { ...plan.page, legal: undefined } }]
      }),
    ),
  }
})

describe('контакты', () => {
  it('форма без политики ПДн в плане — ошибка сборки с ключом: согласию не на что сослаться', async () => {
    const container = await AstroContainer.create()
    await expect(
      container.renderToString(ContactsPage, { props: { locale: DEFAULT_LOCALE } }),
    ).rejects.toThrow(
      'strategy: contacts/legal/privacy_policy — у страницы с формой нет политики ПДн',
    )
  })
})
