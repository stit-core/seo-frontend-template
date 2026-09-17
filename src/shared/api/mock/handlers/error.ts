import { HttpResponse, http } from 'msw'

// В сценарии 'error' все ручки отвечают 500 — удобно проверять error-boundaries.
export function errorHandlers() {
  return [
    http.all('/api/*', () =>
      HttpResponse.json({ message: 'mock: error scenario' }, { status: 500 }),
    ),
  ]
}
