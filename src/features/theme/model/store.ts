import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Scheme = 'light' | 'dark'
export type Locale = 'ru' | 'en'

interface ThemeState {
  scheme: Scheme
  locale: Locale
  setScheme: (scheme: Scheme) => void
  setLocale: (locale: Locale) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      scheme: 'light',
      locale: 'ru',
      setScheme: (scheme) => set({ scheme }),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'app.theme.v1' },
  ),
)
