import { AI_TRAINING_BOTS, buildRobotsTxt } from './robots'

const sitemapUrl = 'https://demo.example/sitemap.xml'

describe('seo/robots', () => {
  it('прод: всё разрешено, абсолютная строка Sitemap, без мёртвых директив Яндекса', () => {
    const body = buildRobotsTxt({ policy: 'index', aiTraining: 'allow', sitemapUrl })
    expect(body).toBe('User-agent: *\nAllow: /\n\nSitemap: https://demo.example/sitemap.xml\n')
    expect(body).not.toMatch(/Host:|Crawl-delay:|GPTBot/)
  })

  it('staging: Disallow: / для всех и без Sitemap', () => {
    const body = buildRobotsTxt({ policy: 'noindex', aiTraining: 'deny', sitemapUrl })
    expect(body).toBe('User-agent: *\nDisallow: /\n')
  })

  it('AI_TRAINING=deny: одна группа с обучающими ботами, поисковые не задеты', () => {
    const body = buildRobotsTxt({ policy: 'index', aiTraining: 'deny', sitemapUrl })
    const groups = body.trim().split('\n\n')
    expect(groups).toHaveLength(3)
    expect(groups[0]).toBe('User-agent: *\nAllow: /')
    expect(groups[1]).toBe(
      `${AI_TRAINING_BOTS.map((bot) => `User-agent: ${bot}`).join('\n')}\nDisallow: /`,
    )
    expect(groups[2]).toBe(`Sitemap: ${sitemapUrl}`)
    expect(body).not.toMatch(/OAI-SearchBot|Claude-SearchBot|PerplexityBot|Googlebot|YandexBot/)
  })
})
