import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'
import { flagGroups, policyMeta } from '../../../scripts/lib/geo-flags.mjs'
import { aiBotsMeta } from './ai-bots'

const registry = load(
  readFileSync(join(import.meta.dirname, 'crawlers.yaml'), 'utf8'),
) as Parameters<typeof policyMeta>[0]

// Таблица серьёзности — в форме `checks` head-kit.yaml базы: точные флаги и шаблоны.
const checks = [
  { flag: 'page-status-*', severity: 'B' },
  { flag: 'blocked-google-googlebot', severity: 'B' },
  { flag: 'blocked-microsoft-bingbot', severity: 'S' },
  { flag: 'blocked-openai-oai-searchbot', severity: 'S' },
  { flag: 'noindex', severity: 'B' },
  { flag: 'nosnippet', severity: 'S' },
  { flag: 'noarchive-or-nocache', severity: 'S' },
  { flag: 'no-canonical', severity: 'S' },
  { flag: 'raw-text-under-200-words', severity: 'D' },
  { flag: 'ua-<бот>-status-<код>', severity: 'S' },
]
const rules = (policy: string) => ({ policy, meta: policyMeta(registry, policy), checks })
const indexable = { noindex: false }
// Мета, которые `deny-all` печатает в <head>, — как их видит проба.
const denyAllHead = { robots_meta: { bingbot: ['noarchive'], applebot: ['nosnippet'] } }

// GEO-шаг /seo-audit (`pnpm geo:probe`) вне гейта: что из флагов пробы базы сайт зовёт дефектом,
// держит этот разбор.
describe('флаги GEO-пробы', () => {
  it('B и S таблицы базы — чинить, D и флаг без серьёзности — к сведению; шаблон флага читается', () => {
    const flags = [
      'page-status-503',
      'ua-gptbot-status-403',
      'blocked-openai-oai-searchbot',
      'raw-text-under-200-words',
      'llms-txt',
    ]
    expect(flagGroups({ flags }, indexable, rules('allow-all'))).toEqual({
      чинить: ['B page-status-503', 'S ua-gptbot-status-403', 'S blocked-openai-oai-searchbot'],
      ожидаемо: [],
      'к сведению': ['D raw-text-under-200-words', '· llms-txt'],
    })
  })

  it('страница закрыта сборкой — её noindex и отсутствие canonical ожидаемы, на индексируемой — чинить', () => {
    const flags = ['noindex', 'no-canonical']
    expect(flagGroups({ flags }, { noindex: true }, rules('allow-all')).ожидаемо).toEqual([
      'noindex (страница закрыта сборкой)',
      'no-canonical (страница закрыта сборкой)',
    ])
    expect(flagGroups({ flags }, indexable, rules('allow-all')).чинить).toEqual([
      'B noindex',
      'S no-canonical',
    ])
  })

  it('deny-all: закрытый ИИ-поисковик и мета политики ожидаемы', () => {
    const flags = ['nosnippet', 'noarchive-or-nocache', 'blocked-openai-oai-searchbot']
    expect(flagGroups({ flags, head: denyAllHead }, indexable, rules('deny-all'))).toEqual({
      чинить: [],
      ожидаемо: flags.map((flag) => `${flag} (политика deny-all)`),
      'к сведению': [],
    })
  })

  it.each([
    ['всем роботам', { robots_meta: { ...denyAllHead.robots_meta, robots: ['nosnippet'] } }],
    ['заголовком', { ...denyAllHead, x_robots_tag: 'nosnippet' }],
    [
      'поисковику мимо политики',
      { robots_meta: { ...denyAllHead.robots_meta, yandex: ['NoSnippet'] } },
    ],
    [
      'другой директивой той же мета',
      { robots_meta: { bingbot: ['noarchive'], applebot: ['nosnippet, noindex'] } },
    ],
  ])('deny-all: nosnippet %s — чинить, а не политика', (_, head) => {
    const groups = flagGroups(
      { flags: ['nosnippet', 'noarchive-or-nocache'], head },
      indexable,
      rules('deny-all'),
    )
    expect(groups.чинить).toEqual(['S nosnippet'])
    expect(groups.ожидаемо).toEqual(['noarchive-or-nocache (политика deny-all)'])
  })

  it('классический поиск закрыт — чинить при любой политике', () => {
    const flags = ['blocked-google-googlebot', 'blocked-microsoft-bingbot']
    for (const policy of ['allow-all', 'deny-all']) {
      expect(flagGroups({ flags }, indexable, rules(policy)).чинить, policy).toEqual([
        'B blocked-google-googlebot',
        'S blocked-microsoft-bingbot',
      ])
    }
  })

  it('без deny-all ни мета, ни закрытый ИИ-поисковик не ожидаемы', () => {
    const flags = ['nosnippet', 'noarchive-or-nocache', 'blocked-openai-oai-searchbot']
    expect(
      flagGroups({ flags, head: denyAllHead }, indexable, rules('allow-search-deny-training'))
        .чинить,
    ).toEqual(flags.map((flag) => `S ${flag}`))
  })

  it('мета политики скрипт читает из реестра так же, как сайт', () => {
    for (const policy of ['allow-all', 'allow-search-deny-training', 'deny-all'] as const) {
      expect(policyMeta(registry, policy), policy).toEqual(aiBotsMeta(policy))
    }
  })
})
