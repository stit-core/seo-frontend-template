import '@testing-library/jest-dom/vitest'
import { expect } from 'vitest'
import type { AxeMatchers } from 'vitest-axe'
// vitest-axe без exports-map: матчер достижим только по dist-пути.
import { toHaveNoViolations } from 'vitest-axe/dist/matchers'

expect.extend({ toHaveNoViolations })

declare module 'vitest' {
  // Сигнатура обязана совпадать с Matchers<T = any> из vitest, иначе merge не сработает.
  // biome-ignore lint/suspicious/noExplicitAny: см. выше
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<T = any> extends AxeMatchers {}
}
