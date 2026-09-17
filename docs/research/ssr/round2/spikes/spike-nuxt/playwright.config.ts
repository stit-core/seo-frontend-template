import { defineConfig, devices } from '@playwright/test'

const port = 3212
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL, trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    env: {
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      NUXT_PUBLIC_SITE_URL: baseURL,
      NUXT_PUBLIC_I18N_BASE_URL: baseURL,
    },
  },
})
