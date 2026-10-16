import type { LocalBusinessInput } from '@/shared/seo'
import { type FactValue, fail, type StrategyPage } from '@/shared/strategy'
import { contactDetails } from '@/widgets/contact-details'
import { heroText } from '@/widgets/hero-text'

type Machine = NonNullable<FactValue['machine']>
const ofType = <T extends Machine['type']>(machines: readonly Machine[], type: T) =>
  machines.find((machine): machine is Extract<Machine, { type: T }> => machine.type === type)

// Дни ряда часов — строкой Schema.org (`Mo,Tu 10:00-19:00`): коды дней факта с заглавной.
const day = (code: string) => `${code.charAt(0).toUpperCase()}${code.slice(1)}`

// LocalBusiness «О компании» размечает то, что показывает её секция контактов: телефон и почту — адреса её ссылок,
// адрес и часы — `machine` фактов, которые называют её строки; юрлицо — оператор плана, описание — подзаголовок первого
// экрана. Чего-то нет — ошибка сборки с ключом: разметка не добавляет фактов, которых нет на странице.
export function businessOf(page: StrategyPage): LocalBusinessInput {
  const key = `${page.id}/contacts`
  const { phone, email, company = [] } = contactDetails.props(page, 'contacts')
  const machines = company.flatMap(({ machine }) => (machine === undefined ? [] : [machine]))
  const address =
    ofType(machines, 'postal-address') ?? fail(key, 'нет факта адреса (machine postal-address)')
  const hours =
    ofType(machines, 'opening-hours') ?? fail(key, 'нет факта часов работы (machine opening-hours)')
  return {
    legalName: page.operator?.text ?? fail(`${page.id}/legal/operator_ref`, 'нет оператора'),
    description: heroText.props(page, 'hero').subheadline,
    email: (email ?? fail(`${key}/email`, 'нет почты')).href.replace(/^mailto:/, ''),
    telephone: (phone ?? fail(`${key}/phone`, 'нет телефона')).href.replace(/^tel:/, ''),
    address: {
      country: address.country,
      postalCode: address.postal_code ?? fail(key, 'у адреса нет индекса'),
      locality: address.locality,
      street: address.street,
    },
    openingHours: hours.hours
      .map(({ days, opens, closes }) => `${days.map(day).join(',')} ${opens}-${closes}`)
      .join(', '),
  }
}
