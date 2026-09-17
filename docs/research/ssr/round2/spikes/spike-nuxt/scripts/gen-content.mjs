import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = resolve(root, 'src/entities/post/content')
const coversDir = resolve(root, 'public/covers')

const titlesRu = [
  [
    'ssr-bez-cdn',
    'SSR без CDN: как отдавать HTML быстро с одного VPS',
    'Разбираем кеш в процессе Node, ETag и почему статика впереди не всегда нужна.',
  ],
  [
    'tehnicheskoe-seo',
    'Техническое SEO для Яндекса и Google в 2026',
    'Canonical, hreflang, robots и sitemap — что реально влияет на индексацию.',
  ],
  [
    'fsd-na-servere',
    'FSD на сервере: слои, которые переживают рендер',
    'Как разложить серверный код по entities/features/widgets и не сломать границы.',
  ],
  [
    'obrazy-node-alpine',
    'Node-образ на alpine: 120 МБ вместо 900',
    'Multi-stage сборка, только выход сборки в рантайме, USER node и healthcheck.',
  ],
  [
    'markdown-kak-baza',
    'Markdown как база данных',
    'Типизированные коллекции, Zod-схема на фронтматтере и запросы без CMS.',
  ],
  [
    'kartinki-avif-webp',
    'AVIF, WebP и честный srcset',
    'Как отдавать обложки в трёх форматах и не потерять индексацию картинок.',
  ],
  [
    'formy-bez-gidratacii',
    'Формы без полной гидратации',
    'Островной подход: интерактив только там, где он действительно нужен.',
  ],
  [
    'i18n-prefiksy',
    'i18n на префиксах: /en/ и ничего лишнего',
    'Почему дефолтная локаль живёт без префикса и как не сломать hreflang.',
  ],
  [
    'redirekty-i-statusy',
    'Редиректы и статусы: 301, 404, 410',
    'Нормализация URL одним хопом и честные коды ответа для поисковиков.',
  ],
  [
    'budjety-proizvoditelnosti',
    'Бюджеты производительности как часть гейта',
    'size-limit, вес HTML и почему бюджет должен падать в CI.',
  ],
  [
    'traefik-i-crowdsec',
    'Traefik и CrowdSec перед контентным сайтом',
    'Whitelist поисковых ботов, rate-limit и 429 вместо 403.',
  ],
  [
    'observability-fronta',
    'Observability фронта без лишнего JS',
    'web-vitals, TTFB и сбор метрик, который не тормозит первый экран.',
  ],
]

const titlesEn = [
  [
    'ssr-bez-cdn',
    'SSR without a CDN: serving HTML fast from a single VPS',
    'In-process Node cache, ETag, and why a static tier up front is not always needed.',
  ],
  [
    'tehnicheskoe-seo',
    'Technical SEO for Yandex and Google in 2026',
    'Canonical, hreflang, robots and sitemap — what actually moves indexing.',
  ],
  [
    'fsd-na-servere',
    'FSD on the server: layers that survive rendering',
    'Splitting server code across entities/features/widgets without breaking boundaries.',
  ],
  [
    'obrazy-node-alpine',
    'A Node image on alpine: 120 MB instead of 900',
    'Multi-stage build, build output only, USER node and a healthcheck.',
  ],
  [
    'markdown-kak-baza',
    'Markdown as a database',
    'Typed collections, a Zod schema over frontmatter, queries without a CMS.',
  ],
  [
    'kartinki-avif-webp',
    'AVIF, WebP and an honest srcset',
    'Serving covers in three formats without losing image indexing.',
  ],
  [
    'formy-bez-gidratacii',
    'Forms without full hydration',
    'The island approach: interactivity only where it is really needed.',
  ],
  [
    'i18n-prefiksy',
    'i18n on prefixes: /en/ and nothing else',
    'Why the default locale lives without a prefix and how not to break hreflang.',
  ],
  [
    'redirekty-i-statusy',
    'Redirects and statuses: 301, 404, 410',
    'One-hop URL normalisation and honest response codes for crawlers.',
  ],
  [
    'budjety-proizvoditelnosti',
    'Performance budgets as part of the gate',
    'size-limit, HTML weight and why a budget must fail CI.',
  ],
  [
    'traefik-i-crowdsec',
    'Traefik and CrowdSec in front of a content site',
    'Whitelisting search bots, rate limiting and 429 instead of 403.',
  ],
  [
    'observability-fronta',
    'Frontend observability without extra JS',
    'web-vitals, TTFB and metrics collection that does not slow the first screen.',
  ],
]

const tagSets = [
  ['ssr', 'infra'],
  ['seo'],
  ['fsd', 'architecture'],
  ['docker', 'infra'],
  ['content', 'markdown'],
  ['images', 'performance'],
  ['islands', 'performance'],
  ['i18n', 'seo'],
  ['seo', 'routing'],
  ['performance'],
  ['infra', 'security'],
  ['observability'],
]

const palette = [
  '#1e293b',
  '#0f766e',
  '#7c2d12',
  '#312e81',
  '#065f46',
  '#7f1d1d',
  '#1e3a8a',
  '#4c1d95',
  '#831843',
  '#134e4a',
  '#3f3f46',
  '#164e63',
]

function bodyRu(title, i) {
  return `
## Зачем это нужно

${title} — тема, которая всплывает в каждом втором проекте. Ниже — практический разбор
без воды: что измеряем, что настраиваем и где обычно ломается.

Ключевая мысль: **решение принимается по измерению**, а не по ощущению. Если вы не
померили TTFB и вес документа до изменения, то после изменения у вас не будет с чем
сравнивать.

## Как это устроено

Сервер отдаёт готовый HTML, браузер показывает контент до того, как загрузится хоть один
байт JavaScript. Клиентский код подключается позже и только там, где он нужен.

1. Запрос приходит на Node-процесс.
2. Процесс отдаёт заранее собранный HTML (или рендерит его на лету).
3. Браузер рисует первый экран.
4. Островки интерактива поднимаются отдельно.

\`\`\`ts
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return renderPage(event)
})
\`\`\`

## Что проверять

- код ответа (200 / 301 / 404 — без «200 и пустая страница»);
- наличие \`<h1>\` и текста в сыром HTML (\`curl\` без JS);
- canonical и hreflang — абсолютными URL;
- вес документа: цель — до 150 КБ несжатого.

## Итог

Шаг ${i + 1} из двенадцати: чем меньше движущихся частей, тем предсказуемее выдача.
Контент-сайт живёт дольше, чем любая мода на фреймворки, и его качество измеряется
в миллисекундах до первого байта и в килобайтах документа.
`.trim()
}

function bodyEn(title, i) {
  return `
## Why this matters

${title} is a recurring topic in every other project. Below is a practical walkthrough:
what to measure, what to configure and where it usually breaks.

The key idea: **decisions follow measurements**, not feelings. If you did not measure TTFB
and document weight before the change, you have nothing to compare against afterwards.

## How it works

The server returns ready HTML, and the browser paints content before a single byte of
JavaScript arrives. Client code attaches later, and only where it is needed.

1. A request reaches the Node process.
2. The process returns pre-built HTML (or renders it on the fly).
3. The browser paints the first screen.
4. Interactive islands boot separately.

\`\`\`ts
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return renderPage(event)
})
\`\`\`

## What to check

- the response code (200 / 301 / 404 — never "200 and an empty page");
- an \`<h1>\` and body text in the raw HTML (\`curl\` with no JS);
- canonical and hreflang as absolute URLs;
- document weight: target under 150 KB uncompressed.

## Takeaway

Step ${i + 1} of twelve: the fewer moving parts, the more predictable the output.
A content site outlives any framework fashion, and its quality is measured in
milliseconds to first byte and kilobytes of document.
`.trim()
}

async function makeCover(slug, _title, color, i) {
  const svg = `<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="#09090b"/>
  </linearGradient></defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <text x="96" y="360" font-family="DejaVu Sans, sans-serif" font-size="88" font-weight="700" fill="#fafafa">stit demo</text>
  <text x="96" y="470" font-family="DejaVu Sans, sans-serif" font-size="46" fill="#d4d4d8">post ${String(i + 1).padStart(2, '0')} / ${slug}</text>
  <rect x="96" y="540" width="240" height="8" fill="#fafafa" opacity="0.7"/>
</svg>`
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(resolve(coversDir, `${slug}.png`))
}

await mkdir(resolve(contentDir, 'ru'), { recursive: true })
await mkdir(resolve(contentDir, 'en'), { recursive: true })
await mkdir(coversDir, { recursive: true })

for (let i = 0; i < titlesRu.length; i++) {
  const [slug, title, description] = titlesRu[i]
  const [, titleEn, descriptionEn] = titlesEn[i]
  const pub = new Date(Date.UTC(2026, 2 + Math.floor(i / 3), 3 + (i % 3) * 8))
    .toISOString()
    .slice(0, 10)
  const upd = new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10)
  const tags = tagSets[i]
  const fm = (t, d) =>
    [
      '---',
      `title: ${JSON.stringify(t)}`,
      `description: ${JSON.stringify(d)}`,
      `pubDate: ${pub}`,
      `updatedDate: ${upd}`,
      `cover: /covers/${slug}.png`,
      `tags: [${tags.map((x) => JSON.stringify(x)).join(', ')}]`,
      '---',
      '',
    ].join('\n')

  await writeFile(
    resolve(contentDir, 'ru', `${slug}.md`),
    `${fm(title, description) + bodyRu(title, i)}\n`,
  )
  await writeFile(
    resolve(contentDir, 'en', `${slug}.md`),
    `${fm(titleEn, descriptionEn) + bodyEn(titleEn, i)}\n`,
  )
  await makeCover(slug, title, palette[i], i)
}
