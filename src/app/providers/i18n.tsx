import { i18n } from '@lingui/core'
import { I18nProvider as LinguiProvider } from '@lingui/react'
import type { ReactNode } from 'react'

interface I18nProviderProps {
  children: ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  return <LinguiProvider i18n={i18n}>{children}</LinguiProvider>
}
