import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const TOPICS = [
  [
    'ssr-i-indeksatsiya',
    'SSR и индексация: почему первый байт решает',
    'SSR and indexing: why the first byte decides',
  ],
  [
    'kanon-tehnicheskogo-seo',
    'Канон технического SEO для шаблона',
    'A technical SEO canon for a template',
  ],
  [
    'fsd-na-servere',
    'FSD на сервере: слои переживают рендер',
    'FSD on the server: layers survive rendering',
  ],
  ['odin-obraz-na-vse-sredy', 'Один образ на все среды', 'One image for every environment'],
  [
    'isr-bez-cdn',
    'ISR без CDN: файловый кеш на VPS',
    'ISR without a CDN: filesystem cache on a VPS',
  ],
  [
    'hreflang-i-lokali',
    'hreflang и локали без авторедиректов',
    'hreflang and locales without auto-redirects',
  ],
  [
    'obrabotka-404-i-301',
    'Честные 404 и 301 вместо мягких ошибок',
    'Honest 404s and 301s instead of soft errors',
  ],
  ['kartinki-avif-webp', 'Картинки: AVIF, WebP и srcset', 'Images: AVIF, WebP and srcset'],
  ['formy-bez-js', 'Формы, которые работают без JS', 'Forms that work without JS'],
  [
    'budgety-i-size-limit',
    'Бюджеты клиентского JS и size-limit',
    'Client JS budgets and size-limit',
  ],
  ['traefik-i-crowdsec', 'Traefik, CrowdSec и краулеры', 'Traefik, CrowdSec and crawlers'],
  [
    'nabludaemost-ssr',
    'Наблюдаемость SSR: логи, health, web-vitals',
    'SSR observability: logs, health, web vitals',
  ],
]

const PARAGRAPH_RU = [
  'Контентный сайт живёт первым HTML-ответом. Если разметка приезжает пустой, краулер уходит ни с чем, а пользователь смотрит на скелет.',
  'Серверный рендер снимает этот риск, но добавляет свой: процесс становится частью продакшена, и его надо уметь наблюдать, ограничивать и перезапускать.',
  'Ключевые развилки — где хранится кеш, кто отдаёт статику и как конфигурация попадает в контейнер. Ответы на них определяют, будет ли один образ работать во всех средах.',
  'Проверяемость важнее красоты: каждое требование канона должно иметь тест, иначе оно превращается в благое пожелание в документации.',
]
const PARAGRAPH_EN = [
  'A content site lives by its first HTML response. If the markup arrives empty, the crawler leaves with nothing and the user stares at a skeleton.',
  'Server rendering removes that risk but adds another: the process becomes part of production and has to be observed, limited and restarted.',
  'The key forks are where the cache lives, who serves the static assets and how configuration reaches the container. Those answers decide whether a single image works everywhere.',
  'Testability beats beauty: every canon requirement needs a test, otherwise it is just a good intention in the docs.',
]

const COLORS = ['#1e3a5f', '#3b2f63', '#0f3d3e', '#4a2545', '#1f3b2c', '#3d2f1f']

for (const [i, [slug, titleRu, titleEn]] of TOPICS.entries()) {
  const day = String(1 + i).padStart(2, '0')
  const pub = `2026-0${1 + (i % 6)}-${day}`
  const upd = `2026-0${1 + ((i + 2) % 6)}-${day}`
  const cover = `/covers/${slug}.png`
  const tags = ['ssr', 'seo', 'infra', 'dx'].filter((_, k) => (i + k) % 3 !== 0)

  const bodyRu =
    PARAGRAPH_RU.map((p, k) => `## Раздел ${k + 1}\n\n${p}\n`).join('\n') +
    '\n> Практика: цифры получены прогоном на реальном железе, а не из документации.\n\n' +
    '- проверяемое требование\n- воспроизводимая команда\n- зафиксированный результат\n\n' +
    '```sh\ncurl -sI http://localhost:3204/blog/' +
    slug +
    '\n```\n'
  const bodyEn =
    PARAGRAPH_EN.map((p, k) => `## Section ${k + 1}\n\n${p}\n`).join('\n') +
    '\n> In practice: the numbers come from a real run, not from the docs.\n\n' +
    '- a checkable requirement\n- a reproducible command\n- a recorded result\n\n' +
    '```sh\ncurl -sI http://localhost:3204/en/blog/' +
    slug +
    '\n```\n'

  const fm = (title, description) =>
    `---\ntitle: "${title}"\ndescription: "${description}"\npubDate: "${pub}"\nupdatedDate: "${upd}"\ncover: "${cover}"\ntags: [${tags.map((t) => `"${t}"`).join(', ')}]\n---\n\n`

  await writeFile(
    `src/entities/post/content/ru/${slug}.md`,
    fm(titleRu, `${titleRu}: разбор на примере spike-сборки и измерений.`) + bodyRu,
  )
  await writeFile(
    `src/entities/post/content/en/${slug}.md`,
    fm(titleEn, `${titleEn}: a walkthrough based on a spike build and measurements.`) + bodyEn,
  )

  const bg = COLORS[i % COLORS.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <rect width="1600" height="900" fill="${bg}"/>
    <circle cx="1350" cy="180" r="260" fill="#ffffff" opacity="0.06"/>
    <text x="80" y="420" font-family="DejaVu Sans, sans-serif" font-size="64" fill="#ffffff" opacity="0.92">${titleEn.slice(0, 34)}</text>
    <text x="80" y="510" font-family="DejaVu Sans, sans-serif" font-size="36" fill="#ffffff" opacity="0.55">stit demo · ${slug}</text>
  </svg>`
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`public/covers/${slug}.png`)
}
console.log('content + covers generated')
