import { z } from 'zod'
import type { AiBotsPolicy } from '@/shared/config'
import crawlers from './crawlers.yaml'

// Реестр ботов — копия файла базы strategy (kb/site/07-seo-geo-performance-analytics/crawlers.yaml)
// байт в байт: норма одна и у владельца — базы, обновляется заменой файла. Сайт читает из него
// политики (`policies`): кому robots.txt закрывает сайт и какие мета ставит <head>.
const PolicySchema = z.object({
  robots_txt: z.string(),
  other_controls: z.array(z.string()).default([]),
})
const { policies } = z
  .object({
    policies: z.object({
      'allow-all': PolicySchema,
      'allow-search-deny-training': PolicySchema,
      'deny-all': PolicySchema,
    }),
  })
  .parse(crawlers)

export interface RobotsMeta {
  name: string
  content: string
}

// Боты, которым политика закрывает сайт, — токены группы с полным запретом в примере robots.txt
// базы. Служебный Disallow группы `*` там — пример, а не политика ИИ-ботов: группа `*` у сайта своя.
export function deniedBots(policy: AiBotsPolicy): string[] {
  return policies[policy].robots_txt.split(/\n\s*\n/).flatMap((group) => {
    const lines = group.split('\n').map((line) => line.replace(/#.*$/, '').trim())
    const agents = lines.flatMap((line) => /^user-agent:\s*(\S+)$/i.exec(line)?.[1] ?? [])
    return lines.some((line) => /^disallow:\s*\/$/i.test(line)) ? agents : []
  })
}

// Мета политики для <head> — как их пишет база в `other_controls`: у deny-all — bingbot и applebot,
// у остальных политик мета нет.
export function aiBotsMeta(policy: AiBotsPolicy): RobotsMeta[] {
  return policies[policy].other_controls.flatMap((control) => {
    const [, name, content] = /<meta name="([^"]+)" content="([^"]+)">/.exec(control) ?? []
    return name !== undefined && content !== undefined ? [{ name, content }] : []
  })
}
