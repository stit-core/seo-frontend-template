import type { ReactNode } from 'react'
import { I18nProvider } from './i18n'
import { QueryProvider } from './query'

export { queryClient } from './query'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <I18nProvider>
      <QueryProvider>{children}</QueryProvider>
    </I18nProvider>
  )
}
