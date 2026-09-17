import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createI18n } from '@/shared/i18n'
import { routeTree } from './routeTree.gen'

// Start вызывает getRouter на КАЖДЫЙ запрос — queryClient и i18n обязаны
// создаваться здесь, иначе кэш одного посетителя утечёт в HTML другого.
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  })
  const i18n = createI18n()

  const router = createRouter({
    routeTree,
    context: { queryClient, i18n },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
