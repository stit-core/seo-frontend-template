import { readdirSync } from 'node:fs'
import { resolve, sep } from 'node:path'

// Демо-ключ IndexNow прод-профиля e2e: webServer поднимается с ним, спек ждёт файл /<ключ>.txt.
export const E2E_INDEXNOW_KEY = 'e2e-indexnow-key-0123456789'

// Все prerendered-страницы — из выхода сборки: ровно то, что статик-хендлер отдаёт в
// контейнере. Читается внутри теста: при загрузке спеков dist/ ещё может не быть.
export function prerenderedPaths(): string[] {
  return readdirSync(resolve(import.meta.dirname, '../dist/client'), {
    recursive: true,
    encoding: 'utf8',
  })
    .map((file) => file.split(sep).join('/'))
    .filter((file) => file.endsWith('index.html'))
    .map((file) => `/${file.replace(/\/?index\.html$/, '')}`)
    .sort()
}
