import { useThemeStore } from '../model/store'

export function ThemeSwitcher() {
  const { scheme, locale, setScheme, setLocale } = useThemeStore()

  return (
    <div className="flex gap-3 items-center">
      <button
        type="button"
        onClick={() => setScheme(scheme === 'light' ? 'dark' : 'light')}
        aria-label="Переключить тему"
        className="px-3 py-1 rounded-control border border-divider"
      >
        {scheme === 'light' ? '🌙' : '☀️'}
      </button>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as 'ru' | 'en')}
        aria-label="Язык интерфейса"
        className="px-2 py-1 rounded-control border border-divider"
      >
        <option value="ru">RU</option>
        <option value="en">EN</option>
      </select>
    </div>
  )
}
