import type { Locale } from '@/shared/i18n'
import {
  form as formSlot,
  type LeadForm,
  type PageFiles,
  type PlanPage,
  type Policy,
  pageLocales,
  pageOf,
  policyOf,
  projectOf,
} from '@/shared/strategy'

// Страница с формой плана для обработчика — её данные и проекция политики согласия: ответ с ошибками рисует маршрут
// из них, композиция страницы ему не нужна.
export interface FormPage {
  files: PageFiles
  consent: unknown
}

// Форма заявки: форма плана на версии своей страницы, её секция, политика согласия и страница — каркас, мета и h1
// (`seo.h1` плана) ответа с ошибками.
export interface FormEntry {
  form: LeadForm
  section: string
  policy: Policy
  locale: Locale
  page: PlanPage
}

// Белый список обработчика — формы плана страниц на каждом языке страницы: `form_id` и `page_url` заявки называют одну
// из них, иначе формы нет. Политику согласия читает только страница с формой.
export function formsOf(pages: readonly FormPage[]): FormEntry[] {
  return pages.flatMap(({ files, consent }) =>
    pageLocales(projectOf(files).plans[0]?.page.id ?? '').flatMap((locale) => {
      const read = pageOf(files, locale)
      const forms = read.sections.flatMap((section) =>
        Object.values(section.slots)
          .filter((value): value is LeadForm => formSlot.safeParse(value).success)
          .map((form) => ({ form, section: section.id })),
      )
      if (forms.length === 0) return []
      const policy = policyOf(read, consent)
      return forms.map(({ form, section }) => ({ form, section, policy, locale, page: read }))
    }),
  )
}

// Страница формы для GET обработчика: первая форма белого списка на языке запроса, без версии на нём — первая форма.
export function formPageOf(forms: readonly FormEntry[], locale: Locale): string {
  const entry = forms.find((candidate) => candidate.locale === locale) ?? forms[0]
  return entry?.form.page ?? '/'
}
