// Источники сетей ботов для allowlist edge (docs/reference/infra-handoff.md § 1.5): по строке на
// бота реестра, который ходит в сеть за поиском, по запросу человека или за обучением, — назначение,
// токен User-Agent, адрес списка сетей вендора и суффиксы обратного DNS; первой строкой — версия
// реестра. Хаб <org>/infra кладёт вывод в свой файл источников как есть: норма печати одна — здесь.
// usage: pnpm bots:sources
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'
import { CRAWLERS_SHA256 } from './lib/site-policy.mjs'

const PURPOSES = ['search', 'user_fetch', 'training']

const registry = readFileSync(resolve(import.meta.dirname, '../src/shared/seo/crawlers.yaml'))
// Версия в первой строке — та, что закреплена в политике сборки: печать другой копии под её именем
// — отказ.
if (createHash('sha256').update(registry).digest('hex') !== CRAWLERS_SHA256) {
  console.error('bots:sources: копия реестра ботов не равна CRAWLERS_SHA256 политики сборки')
  process.exit(1)
}

console.info(`# crawlers.yaml sha256:${CRAWLERS_SHA256}`)
for (const bot of load(registry.toString('utf8')).bots) {
  // Токен управления (`Google-Extended`) в сеть не ходит: он — строка robots.txt, а не бот.
  if (bot.kind === 'control-token' || !PURPOSES.includes(bot.purpose)) continue
  console.info(
    [
      bot.purpose,
      bot.user_agent_token,
      bot.ip_list_url ?? '—',
      bot.rdns_suffix?.join(',') || '—',
    ].join(' '),
  )
}
