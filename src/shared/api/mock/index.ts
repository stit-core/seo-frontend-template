import { type SetupWorker, setupWorker } from 'msw/browser'
import { runtimeConfig } from '@/shared/config'
import { db } from './db'
import { buildHandlers } from './handlers'
import { loadSnapshot, saveSnapshot } from './persist'
import { loadScenario, type Scenario } from './scenarios'

let worker: SetupWorker | null = null

export async function startMockWorker(): Promise<void> {
  const scenario = runtimeConfig.MOCK_SCENARIO

  const hadSnapshot = loadSnapshot(db)
  if (!hadSnapshot) loadScenario(db, scenario)

  worker = setupWorker(...buildHandlers(db, scenario === 'error'))
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  })

  // Простейшая персистентность — каждые 2 секунды дамп в localStorage.
  if (typeof window !== 'undefined') {
    setInterval(() => saveSnapshot(db), 2000)
  }

  if (runtimeConfig.MOCK_DEVTOOLS) {
    await import('./devtools').then((m) => m.mountMockDevtools({ scenario }))
  }
}

export function switchScenario(next: Scenario): void {
  loadScenario(db, next)
  if (worker) {
    worker.resetHandlers(...buildHandlers(db, next === 'error'))
  }
  saveSnapshot(db)
}
