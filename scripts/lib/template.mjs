// Обвязка шаблона в репо — канон или форк. Правило одно у проверок гейта и движка переноса
// scripts/template-update.sh: канон — репо шаблона, его теги v* — версии обвязки; в форке v* — его релизы.
import { execFileSync } from 'node:child_process'

// Имя шаблона — имя его репо; пакет канона — @stit/<имя>. Форк носит своё (check:identity).
export const TEMPLATE_NAME = 'ssr-frontend-template'
export const TEMPLATE_PACKAGE = `@stit/${TEMPLATE_NAME}`

// «Use this template» даёт форку свой origin, а клон шаблона без смены origin — тот же канон. Без origin — форк.
const CANONICAL_ORIGIN = new RegExp(`[:/]stit-core/${TEMPLATE_NAME}(?:\\.git)?/?$`, 'i')

/** @param {string} root */
export function isCanonical(root) {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return CANONICAL_ORIGIN.test(url.trim())
  } catch {
    // Ключа нет — git config выходит с кодом 1: origin не заведён.
    return false
  }
}
