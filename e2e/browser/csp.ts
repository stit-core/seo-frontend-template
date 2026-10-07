import { test as base, expect } from '@playwright/test'

// Каждый браузерный тест заодно держит CSP: заблокированный остров или стиль ломает страницу
// молча, а Chromium сообщает о нарушении только в консоль — «… violates the following Content
// Security Policy directive …» и «Ignoring duplicate Content-Security-Policy directive …».
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ page }, use) => {
      const violations: string[] = []
      page.on('console', (message) => {
        if (/Content.Security.Policy/.test(message.text())) violations.push(message.text())
      })
      await use(violations)
      expect(violations, 'нарушения CSP').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
