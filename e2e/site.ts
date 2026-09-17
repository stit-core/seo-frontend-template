import { readdirSync, readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

// Демо-ключ IndexNow прод-профиля e2e: webServer поднимается с ним, спек ждёт файл /<ключ>.txt.
export const E2E_INDEXNOW_KEY = 'e2e-indexnow-key-0123456789'

// Порт приёмника заявок (e2e/form-stub.mjs): канал доставки формы в тестах локальный.
export const FORM_STUB_PORT = 3202

const clientDir = () => resolve(import.meta.dirname, '../dist/client')

// Все prerendered-страницы — из выхода сборки: ровно то, что статик-хендлер отдаёт в
// контейнере. Читается внутри теста: при загрузке спеков dist/ ещё может не быть.
export function prerenderedPaths(): string[] {
  return readdirSync(clientDir(), { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(sep).join('/'))
    .filter((file) => file.endsWith('index.html'))
    .map((file) => `/${file.replace(/\/?index\.html$/, '')}`)
    .sort()
}

// Индексируемые страницы сборки: prerendered минус служебные, закрытые noindex
// (подтверждение заявки). Это и есть содержимое карты сайта.
export function indexablePaths(): string[] {
  return prerenderedPaths().filter((path) => {
    const file = resolve(clientDir(), `.${path === '/' ? '' : path}/index.html`)
    return !/<meta name="robots" content="noindex"/.test(readFileSync(file, 'utf8'))
  })
}
