import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { E2E_INDEXNOW_KEY, freePort, originOf, PORT_ENV } from './site'

// Порты — свободные на этой машине: второй worktree или чужой сервер прогону не мешают, и
// переиспользовать нечего. Воркеры перечитывают конфиг и наследуют env главного процесса —
// номер выбирается один раз.
for (const name of Object.values(PORT_ENV)) process.env[name] ??= String(await freePort())

const root = resolve(import.meta.dirname, '..')
const site = originOf('site')
const staging = originOf('staging')
const stub = originOf('stub')

// Сервер прогона повторяет контейнер (e2e/serve.mjs): копия сборки, штамповка entrypoint'ом,
// docker/server.mjs. Живость — по /healthz, а не по /: иначе живым сочтётся любой ответ,
// включая 404 непрогретой статики. LOG_LEVEL=error: строки 404 не засоряют вывод гейта.
const server = (origin: string, env: Record<string, string>) => ({
  command: 'node e2e/serve.mjs',
  url: `${origin}/healthz`,
  cwd: root,
  reuseExistingServer: false,
  timeout: 30_000,
  gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 5_000 },
  env: {
    HOST: '127.0.0.1',
    PORT: new URL(origin).port,
    SITE_URL: origin,
    LOG_LEVEL: 'error',
    SHUTDOWN_TIMEOUT_MS: '2000',
    ...env,
  },
})

export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: true,
  workers: 4,
  reporter: 'dot',
  timeout: 30_000,
  use: { baseURL: site },
  projects: [
    // HTTP-контракт прод-сборки — шаг pnpm check: браузер не нужен, только `request`.
    { name: 'http', testDir: './http', testIgnore: 'staging.spec.ts' },
    { name: 'staging', testDir: './http', testMatch: 'staging.spec.ts', use: { baseURL: staging } },
    // Браузерный остаток — обязательный шаг /release: axe в двух темах, тема, форма без JS.
    {
      name: 'browser',
      testDir: './browser',
      use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
    },
  ],
  webServer: [
    {
      // Приёмник заявок: доставка формы в тестах дальше этого процесса не уходит.
      command: 'node e2e/form-stub.mjs',
      url: `${stub}/received`,
      cwd: root,
      reuseExistingServer: false,
      timeout: 10_000,
      env: { FORM_STUB_PORT: new URL(stub).port },
    },
    // Прод-профиль: индексация разрешена, ключ IndexNow задан, заявки — в приёмник.
    server(site, {
      ROBOTS_POLICY: 'index',
      INDEXNOW_KEY: E2E_INDEXNOW_KEY,
      FORM_DELIVERY: 'backend',
      FORM_BACKEND_URL: `${stub}/leads`,
    }),
    // Контур staging: тот же образ, закрытый ROBOTS_POLICY.
    server(staging, { ROBOTS_POLICY: 'noindex' }),
  ],
})
