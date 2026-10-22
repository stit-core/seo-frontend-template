import type { Locale } from '@/shared/i18n'
import {
  form as formSlot,
  type LeadForm,
  type PageFiles,
  type Policy,
  pageLocales,
  pageOf,
  policyOf,
  projectOf,
} from '@/shared/strategy'

// Страница с формой плана для обработчика: её данные, проекция политики согласия и то, чем маршрут рисует ответ
// (композиция страницы).
export interface FormPage<P> {
  files: PageFiles
  consent: unknown
  page: P
}

// Форма заявки: форма плана на версии своей страницы, политика её согласия и страница, которая рисует ответ.
export interface FormEntry<P> {
  form: LeadForm
  policy: Policy
  locale: Locale
  page: P
}

// Белый список обработчика — формы плана страниц на каждом языке страницы: `form_id` и `page_url` заявки называют одну
// из них, иначе формы нет. Политику согласия читает только страница с формой.
export function formsOf<P>(pages: readonly FormPage<P>[]): FormEntry<P>[] {
  return pages.flatMap(({ files, consent, page }) =>
    pageLocales(projectOf(files).plans[0]?.page.id ?? '').flatMap((locale) => {
      const read = pageOf(files, locale)
      const forms = read.sections.flatMap((section) =>
        Object.values(section.slots).filter(
          (value): value is LeadForm => formSlot.safeParse(value).success,
        ),
      )
      if (forms.length === 0) return []
      const policy = policyOf(read, consent)
      return forms.map((form) => ({ form, policy, locale, page }))
    }),
  )
}

// Страница формы для GET обработчика: первая форма белого списка на языке запроса, без версии на нём — первая форма.
export function formPageOf(forms: readonly FormEntry<unknown>[], locale: Locale): string {
  const entry = forms.find((candidate) => candidate.locale === locale) ?? forms[0]
  return entry?.form.page ?? '/'
}
