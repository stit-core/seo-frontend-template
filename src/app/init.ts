import { runtimeConfig } from '@/shared/config'
import { initI18n } from '@/shared/i18n'
import { initObservability } from '@/shared/observability'

// Bootstrap до рендера: MSW в mock-режиме (dynamic import → tree-shake в проде),
// Sentry/web-vitals, Lingui locale.
export async function bootstrap(): Promise<void> {
  await initI18n()
  initObservability()

  if (runtimeConfig.API_MODE === 'mock') {
    const { startMockWorker } = await import('@/shared/api/mock')
    await startMockWorker()
  }
}
