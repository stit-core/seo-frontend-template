import { THEME } from '../../src/shared/config/site.ts'

// Темы, которые сайт показывает, и путь посетителя к каждой: без темы по умолчанию её даёт
// система, заданную полем THEME ставит разметка, остальные — выбор (хранилище острова).
export type Theme = 'light' | 'dark'
export const SITE_THEMES: readonly Theme[] =
  THEME.default === 'system' || THEME.switcher ? ['light', 'dark'] : [THEME.default]

// Тема без выбора посетителя: её даёт система (THEME.default — system) или разметка.
export const bySite = (theme: Theme) => THEME.default === 'system' || THEME.default === theme

// Выбор прошлого визита — хранилище острова предпочтений на origin сайта, до загрузки страницы.
export const stored = (origin: string, theme: Theme) => ({
  cookies: [],
  origins: [{ origin, localStorage: [{ name: 'theme', value: theme }] }],
})
