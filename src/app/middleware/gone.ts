import { type Locale, localePath, t } from '@/shared/i18n'

// Страницы-шаблона для 410 у Astro нет (только 404/500); тело — минимальный автономный HTML
// на системных шрифтах и системной теме, чтобы ответ читался и человеком, и ботом. Язык — локаль
// удалённого адреса.
export function goneResponse(locale: Locale): Response {
  const html = [
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark"><meta name="robots" content="noindex">',
    `<title>410 — ${t(locale, 'gone.title')}</title>`,
    '<style>body{font-family:system-ui,sans-serif;line-height:1.5;max-width:44rem;margin:4rem auto;padding:0 1.5rem}</style>',
    `</head><body><h1>${t(locale, 'gone.title')}</h1>`,
    `<p>${t(locale, 'gone.lead')} <a href="${localePath(locale, '/')}">${t(locale, 'error.home')}</a></p>`,
    '</body></html>',
  ].join('')
  return new Response(html, {
    status: 410,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
  })
}
