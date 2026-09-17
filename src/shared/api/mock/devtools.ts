import { switchScenario } from './index'
import { clearSnapshot } from './persist'
import type { Scenario } from './scenarios'

// Минимальная dev-UI панель в углу для смены сценария. Без зависимостей от React,
// чтобы не зависеть от lifecycle и не светиться в стори/тестах.
export function mountMockDevtools({ scenario }: { scenario: Scenario }): void {
  if (document.getElementById('mock-devtools')) return

  const root = document.createElement('div')
  root.id = 'mock-devtools'
  root.style.cssText = [
    'position:fixed',
    'bottom:8px',
    'left:8px',
    'z-index:99999',
    'background:#111',
    'color:#fff',
    'padding:6px 8px',
    'border-radius:6px',
    'font:12px/1.2 system-ui',
    'display:flex',
    'gap:6px',
    'align-items:center',
    'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
  ].join(';')

  const label = document.createElement('span')
  label.textContent = 'mock:'
  root.append(label)

  const select = document.createElement('select')
  select.style.cssText =
    'background:#222;color:#fff;border:1px solid #333;padding:2px 4px;border-radius:4px'
  const scenarios: Scenario[] = ['empty', 'populated', 'authenticated', 'error']
  scenarios.forEach((s) => {
    const opt = document.createElement('option')
    opt.value = s
    opt.textContent = s
    if (s === scenario) opt.selected = true
    select.append(opt)
  })
  select.addEventListener('change', () => {
    switchScenario(select.value as Scenario)
    window.location.reload()
  })
  root.append(select)

  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = 'reset'
  reset.style.cssText =
    'background:#444;color:#fff;border:0;padding:2px 6px;border-radius:4px;cursor:pointer'
  reset.addEventListener('click', () => {
    clearSnapshot()
    window.location.reload()
  })
  root.append(reset)

  document.body.append(root)
}
