import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { CRAWLERS_SHA256 } from '../../../scripts/lib/site-policy.mjs'

// `pnpm bots:sources` — норма печати источников ботов для allowlist edge: её вывод хаб <org>/infra
// кладёт в свой файл как есть (docs/reference/infra-handoff.md § 1.5), поэтому формат — контракт.
describe('pnpm bots:sources', () => {
  const run = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, '../../../scripts/bot-sources.mjs')],
    { encoding: 'utf8', timeout: 15_000 },
  )
  const [version, ...lines] = run.stdout.trimEnd().split('\n')
  const rows = lines.map((line) => line.split(' '))
  const row = (token: string) => rows.find(([, name]) => name === token)

  it('первая строка — версия реестра, закреплённая в политике сборки', () => {
    expect(run.status).toBe(0)
    expect(version).toBe(`# crawlers.yaml sha256:${CRAWLERS_SHA256}`)
  })

  it('строка бота — четыре поля через пробел: назначение, токен, список сетей вендора, суффиксы rDNS', () => {
    expect(rows.length).toBeGreaterThan(0)
    for (const fields of rows) {
      expect(fields, fields.join(' ')).toHaveLength(4)
      const [purpose, token, ipList, rdns] = fields
      expect(['search', 'user_fetch', 'training'], token).toContain(purpose)
      expect(token).toMatch(/^[\w-]+$/)
      expect(ipList, token).toMatch(/^(—|https:\/\/\S+)$/)
      expect(rdns, token).toMatch(/^(—|[a-z0-9.-]+(,[a-z0-9.-]+)*)$/)
    }
  })

  it('поисковые, user-fetch и обучающие боты на месте; токен управления robots.txt — не бот', () => {
    expect(row('OAI-SearchBot')?.[0]).toBe('search')
    expect(row('ChatGPT-User')?.[0]).toBe('user_fetch')
    expect(row('GPTBot')?.[0]).toBe('training')
    // Яндекс списка сетей не публикует — только суффиксы обратного DNS.
    expect(row('YandexBot')?.slice(2)).toEqual(['—', expect.stringContaining('yandex.ru')])
    expect(row('Google-Extended')).toBeUndefined()
  })
})
