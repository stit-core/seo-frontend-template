import { runtimeConfig } from '@/shared/config'

// Sentry + web-vitals. Подключение условное: dynamic import только при наличии DSN —
// в проде без DSN ни байта Sentry в бандл не попадает.
export function initObservability(): void {
  if (runtimeConfig.SENTRY_DSN) {
    void initSentry()
  }
  void initWebVitals()
}

async function initSentry(): Promise<void> {
  const Sentry = await import('@sentry/react')
  Sentry.init({
    dsn: runtimeConfig.SENTRY_DSN,
    environment: runtimeConfig.SENTRY_ENVIRONMENT,
    release: runtimeConfig.RELEASE,
    tracesSampleRate: 0.1,
  })
}

async function initWebVitals(): Promise<void> {
  const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals')
  const report = (metric: { name: string; value: number }) => {
    if (import.meta.env.DEV) {
      console.info(`[web-vitals] ${metric.name}: ${metric.value.toFixed(2)}`)
    }
  }
  onCLS(report)
  onINP(report)
  onLCP(report)
  onFCP(report)
  onTTFB(report)
}
