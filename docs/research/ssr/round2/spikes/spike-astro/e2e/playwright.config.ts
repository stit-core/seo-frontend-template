import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:3201' },
  webServer: {
    command: 'node ./dist/server/entry.mjs',
    url: 'http://127.0.0.1:3201/healthz',
    reuseExistingServer: true,
    timeout: 60_000,
    env: { HOST: '127.0.0.1', PORT: '3201', SITE_URL: 'http://localhost:3201' },
  },
})
