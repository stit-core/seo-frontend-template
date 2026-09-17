import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // src/app — маршруты Next (page.tsx/layout.tsx/route.ts) плюс сегменты
    // styles/fonts. Public API и «сегменты по назначению» здесь неприменимы:
    // имена файлов задаёт фреймворк.
    files: ['./src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off', 'fsd/public-api': 'off' },
  },
  {
    // Steiger не знает слоя `views`, поэтому не видит ссылок из него в widgets/
    // features. Без отключения эти слайсы вечно «без референсов».
    files: ['./src/widgets/**', './src/features/**'],
    rules: { 'fsd/insignificant-slice': 'off' },
  },
  {
    // shared/seo — сегмент sliceless-слоя; вложенный lib/ Steiger считает
    // зарезервированным именем.
    files: ['./src/shared/seo/**'],
    rules: { 'fsd/no-reserved-folder-names': 'off' },
  },
])
