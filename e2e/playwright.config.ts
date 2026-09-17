import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { E2E_INDEXNOW_KEY } from './site'

const PORT = 3201
const ORIGIN = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI && { workers: 2 }),
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  timeout: 30_000,
  use: { baseURL: ORIGIN, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Ровно то, что делает контейнер: prod-сборка без SITE_URL (в выход попадает
    // плейсхолдер origin), штамповка entrypoint'ом, обёртка server.mjs. url — /healthz,
    // а не /: иначе Playwright примет за «живой» любой ответ, включая 404 непрогретой статики.
    command: 'env -u SITE_URL pnpm build && sh docker/entrypoint.sh node docker/server.mjs',
    url: `${ORIGIN}/healthz`,
    cwd: resolve(import.meta.dirname, '..'),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Прод-профиль: индексация разрешена, ключ IndexNow задан (файл /<ключ>.txt существует).
    env: {
      DIST_DIR: 'dist',
      HOST: '127.0.0.1',
      PORT: String(PORT),
      SITE_URL: ORIGIN,
      ROBOTS_POLICY: 'index',
      INDEXNOW_KEY: E2E_INDEXNOW_KEY,
    },
  },
})
