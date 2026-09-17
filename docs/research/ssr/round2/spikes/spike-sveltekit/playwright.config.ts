import { defineConfig } from '@playwright/test'

const port = 3213

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: 'node build',
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: false,
    env: {
      PORT: String(port),
      HOST: '127.0.0.1',
      ORIGIN: `http://127.0.0.1:${port}`,
      SITE_URL: `http://127.0.0.1:${port}`,
    },
  },
})
