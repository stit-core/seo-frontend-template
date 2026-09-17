export interface RobotsOptions {
  policy: 'index' | 'noindex'
  aiTraining: 'allow' | 'deny'
  // Абсолютный URL карты сайта (runtime origin).
  sitemapUrl: string
}

// Обучающие AI-краулеры; поисково-ответные боты (OAI-SearchBot, Claude-SearchBot, PerplexityBot)
// в список не входят — это видимость в AI-ответах, а не обучение. Запрет — решение владельца
// сайта (AI_TRAINING=deny), не дефолт шаблона.
export const AI_TRAINING_BOTS = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
] as const

// Staging (`noindex`) — только `Disallow: /`, без строки Sitemap. Host и Crawl-delay Яндекс
// отменил — не выводятся; Clean-param для проектных трекинг-параметров добавляется здесь же,
// когда они появятся (utm_*, ysclid, yrclid Яндекс срезает сам).
export function buildRobotsTxt({ policy, aiTraining, sitemapUrl }: RobotsOptions): string {
  if (policy === 'noindex') return 'User-agent: *\nDisallow: /\n'
  const groups = ['User-agent: *\nAllow: /']
  if (aiTraining === 'deny') {
    groups.push([...AI_TRAINING_BOTS.map((bot) => `User-agent: ${bot}`), 'Disallow: /'].join('\n'))
  }
  groups.push(`Sitemap: ${sitemapUrl}`)
  return `${groups.join('\n\n')}\n`
}
