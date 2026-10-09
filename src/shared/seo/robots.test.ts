import { type AiBotsPolicy, CLEAN_PARAMS } from '@/shared/config'
import crawlers from './crawlers.yaml'
import { buildRobotsTxt } from './robots'

const sitemapUrl = 'https://demo.example/sitemap.xml'
const cleanParams = ['yclid', 'gclid']
const robots = (aiBots: AiBotsPolicy) =>
  buildRobotsTxt({ policy: 'index', aiBots, cleanParams, sitemapUrl })

// Бот реестра — как его описывает база: кому служит и как читает robots.txt.
interface Bot {
  user_agent_token: string
  purpose: 'training' | 'search' | 'user_fetch' | 'ads' | 'other'
  respects_robots: 'yes' | 'partial' | 'no' | 'not-stated'
  star_group_applies: boolean
  robots_fallback?: string[]
}
const { bots, policies } = crawlers as {
  bots: Bot[]
  policies: Record<AiBotsPolicy, { robots_txt: string }>
}
// Классический поиск — литералом, а не из реестра: его не закрывает ни одна политика ИИ-ботов.
const CLASSIC_SEARCH = ['YandexBot', 'Googlebot', 'bingbot', 'Applebot']
const POLICIES: AiBotsPolicy[] = ['allow-all', 'allow-search-deny-training', 'deny-all']

interface Group {
  agents: string[]
  rules: { allow: boolean; path: string }[]
}

// Группы файла: подряд идущие User-agent делят одни правила; строки вне групп (Sitemap) — не правила.
function parse(body: string): Group[] {
  const groups: Group[] = []
  let collectingAgents = false
  for (const line of body.split('\n')) {
    const [, field, value = ''] =
      /^(user-agent|allow|disallow)\s*:\s*(\S*)/i.exec(line.replace(/#.*$/, '').trim()) ?? []
    if (field === undefined) continue
    if (field.toLowerCase() === 'user-agent') {
      if (!collectingAgents) groups.push({ agents: [], rules: [] })
      groups.at(-1)?.agents.push(value.toLowerCase())
      collectingAgents = true
    } else {
      groups.at(-1)?.rules.push({ allow: field.toLowerCase() === 'allow', path: value })
      collectingAgents = false
    }
  }
  return groups
}

// Доступ бота к пути по RFC 9309 § 2.2: правила группы своего токена (без учёта регистра, группы
// одного токена складываются), иначе — запасного токена бота, иначе — `*`, если бот её читает;
// из совпавших правил решает самое длинное, при равенстве — Allow; ни одно не совпало — можно.
function allows(body: string, bot: Bot, path: string): boolean {
  const groups = parse(body)
  const rulesOf = (token: string) =>
    groups
      .filter((group) => group.agents.includes(token.toLowerCase()))
      .flatMap((group) => group.rules)
  const tokens = [
    bot.user_agent_token,
    ...(bot.robots_fallback ?? []),
    ...(bot.star_group_applies ? ['*'] : []),
  ]
  const rules = tokens.map(rulesOf).find((list) => list.length > 0) ?? []
  const [decisive] = rules
    .filter((rule) => rule.path !== '' && path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow))
  return decisive?.allow ?? true
}

describe('seo/robots', () => {
  it('прод, allow-all: всё разрешено, Clean-param Яндексу, абсолютная строка Sitemap, без мёртвых директив', () => {
    const body = robots('allow-all')
    expect(body).toBe(
      'User-agent: *\nAllow: /\n\nClean-param: yclid&gclid\n\nSitemap: https://demo.example/sitemap.xml\n',
    )
    expect(body).not.toMatch(/Host:|Crawl-delay:|GPTBot/)
  })

  it('staging: Disallow: / для всех, без Sitemap и Clean-param — при любой политике ИИ-ботов', () => {
    for (const aiBots of POLICIES) {
      expect(buildRobotsTxt({ policy: 'noindex', aiBots, cleanParams, sitemapUrl })).toBe(
        'User-agent: *\nDisallow: /\n',
      )
    }
  })

  it('политика с запретом: одна именная группа между открытой `*` и строками Clean-param и Sitemap', () => {
    for (const aiBots of ['allow-search-deny-training', 'deny-all'] as const) {
      const blocks = robots(aiBots).trim().split('\n\n')
      expect(blocks).toHaveLength(4)
      expect(blocks[0]).toBe('User-agent: *\nAllow: /')
      expect(blocks[1]).toMatch(/^(User-agent: \S+\n)+Disallow: \/$/)
      expect(blocks[2]).toBe('Clean-param: yclid&gclid')
      expect(blocks[3]).toBe(`Sitemap: ${sitemapUrl}`)
    }
  })

  it('без служебных параметров строки Clean-param нет', () => {
    expect(
      buildRobotsTxt({ policy: 'index', aiBots: 'allow-all', cleanParams: [], sitemapUrl }),
    ).toBe('User-agent: *\nAllow: /\n\nSitemap: https://demo.example/sitemap.xml\n')
  })

  // Правило Clean-param — одна строка до 500 символов, имена — через `&`: разделитель или пробел в
  // имени ломает директиву молча. Метки кликов Директа и Google Ads — умолчание шаблона.
  it('служебные параметры сайта: метки кликов рекламы на месте, имена — без разделителей, правило — до 500 символов', () => {
    expect(CLEAN_PARAMS).toEqual(expect.arrayContaining(['yclid', 'gclid', 'fbclid']))
    for (const name of CLEAN_PARAMS) expect(name, name).toMatch(/^[\w.-]+$/)
    expect(new Set(CLEAN_PARAMS).size).toBe(CLEAN_PARAMS.length)
    expect(`Clean-param: ${CLEAN_PARAMS.join('&')}`.length).toBeLessThanOrEqual(500)
  })

  // Ожидания — не из группы, которую печатает сайт: назначение бота (`purpose`) и список
  // классического поиска. Потерянный или лишний токен в политике реестра краснеет здесь.
  describe('матрица доступа «политика × бот» по RFC 9309', () => {
    const readers = bots.filter((bot) => bot.respects_robots !== 'no')
    const paths = ['/', '/blog/zapis']

    it('реестр читается: в нём и классический поиск, и ИИ-боты каждого назначения', () => {
      const tokens = readers.map((bot) => bot.user_agent_token)
      expect(tokens).toEqual(expect.arrayContaining(CLASSIC_SEARCH))
      for (const purpose of ['training', 'search', 'user_fetch'] as const) {
        expect(readers.filter((bot) => bot.purpose === purpose).length, purpose).toBeGreaterThan(3)
      }
    })

    it.each(POLICIES)('%s: каждому боту — тот же доступ, что в политике базы', (policy) => {
      const body = robots(policy)
      for (const bot of readers) {
        for (const path of paths) {
          expect(allows(body, bot, path), `${bot.user_agent_token} ${path}`).toBe(
            allows(policies[policy].robots_txt, bot, path),
          )
        }
      }
    })

    it.each(POLICIES)('%s: классический поиск открыт', (policy) => {
      const body = robots(policy)
      for (const bot of readers.filter((item) => CLASSIC_SEARCH.includes(item.user_agent_token))) {
        for (const path of paths) expect(allows(body, bot, path), bot.user_agent_token).toBe(true)
      }
    })

    it('allow-all: открыт каждому боту реестра', () => {
      for (const bot of readers) {
        expect(allows(robots('allow-all'), bot, '/'), bot.user_agent_token).toBe(true)
      }
    })

    it('allow-search-deny-training: закрыты обучающие боты — и только они', () => {
      const body = robots('allow-search-deny-training')
      for (const bot of readers) {
        expect(allows(body, bot, '/'), bot.user_agent_token).toBe(bot.purpose !== 'training')
      }
    })

    it('deny-all: закрыты обучающие и поисковые ИИ-боты, реклама и превью ссылок — нет', () => {
      const body = robots('deny-all')
      for (const bot of readers) {
        const token = bot.user_agent_token
        if (bot.purpose === 'training') expect(allows(body, bot, '/'), token).toBe(false)
        if (bot.purpose === 'search') {
          expect(allows(body, bot, '/'), token).toBe(CLASSIC_SEARCH.includes(token))
        }
        if (bot.purpose === 'ads' || bot.purpose === 'other') {
          expect(allows(body, bot, '/'), token).toBe(true)
        }
      }
    })
  })
})
