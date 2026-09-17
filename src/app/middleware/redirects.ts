import { t } from '@/shared/i18n'
import { buildRedirectTable, type RedirectRule, redirectLocation } from '@/shared/redirects'
import redirects from '../../../content/redirects.yaml'

// Таблица строится один раз при загрузке серверного бандла: YAML разобран на сборке
// (плагин yaml-modules в astro.config.ts), в бандле лежат данные, файл в контейнере не
// нужен. Невалидные данные роняют старт процесса — раньше их ловит `pnpm check:content`.
const table = buildRedirectTable(redirects)

// Точное совпадение: хвостовой слеш Astro срезает 301-м ещё до middleware
// (`trailingSlash: 'never'`), так что сюда `/old/` не доходит; регистр не нормализуется —
// URL к нему чувствительны, как и везде на сайте.
export function matchRedirect(pathname: string): RedirectRule | undefined {
  return table.get(pathname)
}

export function redirectResponse(rule: RedirectRule, search = ''): Response {
  if (rule.status === 410) return goneResponse()
  return new Response(null, {
    status: rule.status,
    headers: { location: redirectLocation(rule.to, search) },
  })
}

// Страницы-шаблона для 410 у Astro нет (только 404/500); тело — минимальный автономный HTML
// на системных шрифтах и системной теме, чтобы ответ читался и человеком, и ботом.
function goneResponse(): Response {
  const html = [
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark"><meta name="robots" content="noindex">',
    `<title>410 — ${t('ru', 'gone.title')}</title>`,
    '<style>body{font-family:system-ui,sans-serif;line-height:1.5;max-width:44rem;margin:4rem auto;padding:0 1.5rem}</style>',
    `</head><body><h1>${t('ru', 'gone.title')}</h1>`,
    `<p>${t('ru', 'gone.lead')} <a href="/">${t('ru', 'notFound.home')}</a></p>`,
    `<p lang="en">${t('en', 'gone.lead')} <a href="/en">${t('en', 'notFound.home')}</a></p>`,
    '</body></html>',
  ].join('')
  return new Response(html, {
    status: 410,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
  })
}
