import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

describe('strategy/contract — модуль для скриптов', () => {
  // Скрипты гейта исполняют TS напрямую — Node без сборки и без алиасов @/: правила контракта им доступны, пока
  // модуль листовой.
  it('Node импортирует модуль правил без сборки', () => {
    const module = pathToFileURL(join(import.meta.dirname, 'contract.ts')).href
    const run = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `const rules = await import(${JSON.stringify(module)}); console.log(Object.keys(rules).join(' '))`,
      ],
      { encoding: 'utf8', timeout: 20_000 },
    )
    expect(run.stderr).toBe('')
    expect(run.stdout.trim().split(' ')).toEqual(
      expect.arrayContaining(['PlanSchema', 'CopyDeckSchema', 'chosenText', 'targetAddress']),
    )
  })
})
