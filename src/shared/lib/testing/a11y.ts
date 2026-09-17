import axe from 'axe-core'
import { Window } from 'happy-dom'

// Матчер для фрагментов, отрендеренных Container API (node-окружение): фрагмент
// вставляется в happy-dom, axe гоняется через глобальные window/document —
// иначе он их не находит.
export async function expectNoA11yViolations(html: string): Promise<void> {
  const window = new Window({ url: 'https://example.com/' })
  window.document.body.innerHTML = html

  const g = globalThis as { window?: unknown; document?: unknown }
  const saved = { window: g.window, document: g.document }
  g.window = window
  g.document = window.document
  try {
    const { violations } = await axe.run(window.document.body as unknown as Element, {
      // Изолированный фрагмент вне <main> всегда нарушает `region`.
      rules: { region: { enabled: false } },
    })
    if (violations.length > 0) {
      const report = violations
        .map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`)
        .join('\n')
      throw new Error(`a11y violations:\n${report}`)
    }
  } finally {
    g.window = saved.window
    g.document = saved.document
    window.close()
  }
}
