import type { AxeMatchers } from 'vitest-axe/matchers'

declare module 'vitest' {
  // vitest-axe 0.1.0 расширяет старый Vi.Assertion; Vitest 4 подключает
  // кастомные матчеры через интерфейс Matchers.
  interface Matchers extends AxeMatchers {}
}
