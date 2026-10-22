import { SUPPORTED_LOCALES } from '@/shared/i18n'
import { type LeadForm, pageLocales, snapshot, strategyPage } from '@/shared/strategy'
import { FORM_DICTS } from './dict'

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort()

describe('словарь формы', () => {
  it('у каждой локали — те же ключи и подстановки', () => {
    const [base, ...others] = SUPPORTED_LOCALES.map(
      (locale) => FORM_DICTS[locale] as Readonly<Record<string, string>>,
    )
    for (const dict of others) {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(base ?? {}).sort())
      for (const [key, text] of Object.entries(dict))
        expect(placeholders(text), key).toEqual(placeholders(base?.[key] ?? ''))
    }
  })

  // Подписи — данные формы: поле и вариант набора, который называет план, и группа «хотя бы одного из» есть на каждом
  // языке страницы с формой.
  it('у формы каждого плана — подпись каждого поля, варианта и группы на каждом языке её страницы', () => {
    const missing: string[] = []
    for (const { page } of snapshot().plans) {
      for (const locale of pageLocales(page.id)) {
        const dict: Readonly<Record<string, string>> = FORM_DICTS[locale]
        for (const section of strategyPage(page.id, locale).sections) {
          const form = section.slots.form as LeadForm | undefined
          if (form?.fields === undefined) continue
          const keys = [
            ...form.fields.flatMap((field) => [
              `label.${field.id}`,
              ...field.options.map((option) => `option.${field.id}.${option}`),
            ]),
            `label.${form.honeypot}`,
            ...(form.oneOf.length > 0 ? [`oneOf.${[...form.oneOf].sort().join('+')}`] : []),
          ]
          missing.push(
            ...keys
              .filter((key) => dict[key] === undefined)
              .map((key) => `${form.id} ${locale}: ${key}`),
          )
        }
      }
    }
    expect(missing).toEqual([])
  })
})
