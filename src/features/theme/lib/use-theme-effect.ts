import { useEffect } from 'react'
import { activateLocale } from '@/shared/i18n'
import { useThemeStore } from '../model/store'

// Применение data-scheme к html и активация Lingui locale.
export function useThemeEffect(): void {
  const scheme = useThemeStore((s) => s.scheme)
  const locale = useThemeStore((s) => s.locale)

  useEffect(() => {
    document.documentElement.dataset.scheme = scheme
  }, [scheme])

  useEffect(() => {
    void activateLocale(locale)
  }, [locale])
}
