import type { AiBotsPolicy } from '@/shared/config'
import { deniedBots } from './ai-bots'

export interface RobotsOptions {
  policy: 'index' | 'noindex'
  aiBots: AiBotsPolicy
  // Служебные параметры адреса, которые страницу не меняют (метки кликов рекламы).
  cleanParams: readonly string[]
  // Абсолютный URL карты сайта (runtime origin).
  sitemapUrl: string
}

// Staging (`noindex`) — только `Disallow: /`: ни карты, ни Clean-param — индексировать там нечего.
// Группа `*` открыта при любой политике ИИ-ботов: классический поиск не закрывает ни одна, а боты
// политики — отдельная именная группа. Clean-param читает только Яндекс (Google склеивает адреса с
// параметрами по canonical); директива межсекционная — стоит своей строкой вне групп и доступ ни
// одному боту не меняет. Host и Crawl-delay Яндекс отменил — не выводятся.
export function buildRobotsTxt({ policy, aiBots, cleanParams, sitemapUrl }: RobotsOptions): string {
  if (policy === 'noindex') return 'User-agent: *\nDisallow: /\n'
  const blocks = ['User-agent: *\nAllow: /']
  const denied = deniedBots(aiBots)
  if (denied.length > 0) {
    blocks.push([...denied.map((bot) => `User-agent: ${bot}`), 'Disallow: /'].join('\n'))
  }
  if (cleanParams.length > 0) blocks.push(`Clean-param: ${cleanParams.join('&')}`)
  blocks.push(`Sitemap: ${sitemapUrl}`)
  return `${blocks.join('\n\n')}\n`
}
