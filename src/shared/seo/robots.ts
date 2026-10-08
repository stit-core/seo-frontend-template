import type { AiBotsPolicy } from '@/shared/config'
import { deniedBots } from './ai-bots'

export interface RobotsOptions {
  policy: 'index' | 'noindex'
  aiBots: AiBotsPolicy
  // Абсолютный URL карты сайта (runtime origin).
  sitemapUrl: string
}

// Staging (`noindex`) — только `Disallow: /`, без строки Sitemap. Группа `*` открыта при любой
// политике ИИ-ботов: классический поиск не закрывает ни одна, а боты политики — отдельная именная
// группа. Host и Crawl-delay Яндекс отменил — не выводятся; Clean-param для проектных
// трекинг-параметров добавляется здесь же, когда они появятся (utm_*, ysclid, yrclid Яндекс
// срезает сам).
export function buildRobotsTxt({ policy, aiBots, sitemapUrl }: RobotsOptions): string {
  if (policy === 'noindex') return 'User-agent: *\nDisallow: /\n'
  const groups = ['User-agent: *\nAllow: /']
  const denied = deniedBots(aiBots)
  if (denied.length > 0) {
    groups.push([...denied.map((bot) => `User-agent: ${bot}`), 'Disallow: /'].join('\n'))
  }
  groups.push(`Sitemap: ${sitemapUrl}`)
  return `${groups.join('\n\n')}\n`
}
