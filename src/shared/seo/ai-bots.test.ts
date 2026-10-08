import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CRAWLERS_SHA256 } from '../../../scripts/lib/site-policy.mjs'
import { aiBotsMeta, deniedBots } from './ai-bots'

// Кого именно закрывает каждая политика, держит матрица доступа в robots.test.ts; здесь — то, что
// сайт вычитывает из реестра: закрытые токены и мета.
describe('seo/ai-bots', () => {
  // Реестр — копия файла базы: правка руками разошлась бы с нормой молча, а матрица сверяет сайт с
  // самой копией. Новая версия базы — замена файла и sha256 в политике сборки одним диффом.
  it('копия реестра — версия, закреплённая в политике сборки', () => {
    const registry = readFileSync(join(import.meta.dirname, 'crawlers.yaml'))
    expect(createHash('sha256').update(registry).digest('hex')).toBe(CRAWLERS_SHA256)
  })

  it('allow-all никого не закрывает', () => {
    expect(deniedBots('allow-all')).toEqual([])
  })

  it('allow-search-deny-training закрывает обучающих ботов, не поисковых; deny-all — и тех и других', () => {
    const training = deniedBots('allow-search-deny-training')
    expect(training).toContain('GPTBot')
    expect(training).toContain('CCBot')
    expect(training).not.toContain('OAI-SearchBot')
    const all = deniedBots('deny-all')
    expect(all).toEqual(expect.arrayContaining(training))
    expect(all).toContain('OAI-SearchBot')
    expect(all).toContain('YandexAdditional')
    for (const open of ['*', 'Googlebot', 'YandexBot', 'bingbot', 'Applebot']) {
      expect(all, open).not.toContain(open)
    }
  })

  it('мета — только у deny-all: bingbot вне ответов Copilot, applebot вне ИИ-ответов Apple', () => {
    expect(aiBotsMeta('deny-all')).toEqual([
      { name: 'bingbot', content: 'noarchive' },
      { name: 'applebot', content: 'nosnippet' },
    ])
    expect(aiBotsMeta('allow-all')).toEqual([])
    expect(aiBotsMeta('allow-search-deny-training')).toEqual([])
  })
})
