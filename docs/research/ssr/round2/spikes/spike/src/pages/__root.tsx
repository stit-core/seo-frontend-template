/// <reference types="vite/client" />
import { I18nProvider } from '@lingui/react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import appCss from '@/app/styles/index.css?url'
import { readScheme } from '@/features/theme'
import { DEFAULT_LOCALE, type I18n, isLocale } from '@/shared/i18n'

interface RouterContext {
  queryClient: QueryClient
  i18n: I18n
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'stit SSR spike' },
      { name: 'theme-color', content: '#0a0a0a' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: ({ location, context }) => {
    const first = location.pathname.split('/')[1] ?? ''
    const locale = isLocale(first) ? first : DEFAULT_LOCALE
    context.i18n.activate(locale)
    return { locale, scheme: readScheme() }
  },
  notFoundComponent: () => (
    <main className="px-6 py-8">
      <h1 className="text-heading-lg font-semibold">404 — страница не найдена</h1>
      <p className="text-body-md text-muted">Проверьте адрес или вернитесь на главную.</p>
    </main>
  ),
  component: RootDocument,
})

function RootDocument() {
  const { locale, scheme, i18n } = Route.useRouteContext()

  return (
    <html lang={locale} data-scheme={scheme}>
      <head>
        <HeadContent />
      </head>
      <body>
        <I18nProvider i18n={i18n}>
          <Outlet />
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  )
}
