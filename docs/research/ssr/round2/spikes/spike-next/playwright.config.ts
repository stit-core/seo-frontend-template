import { defineConfig } from '@playwright/test'

const PORT = 3204

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    // Гоняем ровно то, что уедет в образ: standalone-сервер, не `next start`.
    command: 'node .next/standalone/server.js',
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: true,
    env: {
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      SITE_URL: `http://127.0.0.1:${PORT}`,
      ROBOTS_POLICY: 'index',
      REVALIDATE_SECRET: 'dev-secret',
    },
  },
})
