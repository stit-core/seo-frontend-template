import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'src/entities/post/content')
const coversDir = join(contentDir, 'covers')

const posts = [
  [
    'ssr-i-indeksatsiya',
    'SSR и индексация: почему первый HTML решает всё',
    'Как серверный рендер влияет на скорость обхода, рендер-очередь Google и поведение Яндекса.',
    ['ssr', 'seo'],
    '#1f6feb',
  ],
  [
    'prerender-bez-cdn',
    'Prerender без CDN: когда статика живёт внутри Node-процесса',
    'Разбираем, кто и как отдаёт заранее отрендеренный HTML, если перед приложением нет CDN.',
    ['prerender', 'deploy'],
    '#8957e5',
  ],
  [
    'canonical-i-runtime-config',
    'Canonical и runtime-конфигурация: один образ на все среды',
    'Абсолютный canonical требует знать origin, а origin известен только контейнеру.',
    ['seo', 'config'],
    '#238636',
  ],
  [
    'trailing-slash',
    'Trailing slash: одна косая черта и два URL',
    'Нормализация адресов одним редиректом и почему 308 лучше 302.',
    ['seo', 'routing'],
    '#da3633',
  ],
  [
    'hreflang-dlya-dvuh-lokaley',
    'hreflang для двух локалей',
    'Взаимные ссылки, x-default и типичные ошибки при префиксной схеме локалей.',
    ['i18n', 'seo'],
    '#1f6feb',
  ],
  [
    'jsonld-article',
    'JSON-LD Article: минимальный честный набор',
    'Что действительно нужно поисковикам и чего не стоит выдумывать.',
    ['structured-data', 'seo'],
    '#8957e5',
  ],
  [
    'nol-javascript',
    'Ноль JavaScript на контентной странице',
    'Отключаем гидрацию там, где интерактива нет, и считаем реальные байты.',
    ['performance'],
    '#238636',
  ],
  [
    'obrabotka-form-bez-js',
    'Обработка форм без JavaScript',
    'Прогрессивное улучшение: одна и та же форма работает и с JS, и без него.',
    ['forms', 'a11y'],
    '#da3633',
  ],
  [
    'kartinki-avif-webp',
    'Картинки: AVIF, WebP и честный srcset',
    'Сборочный пайплайн изображений и почему динамические пути — отдельная история.',
    ['images', 'performance'],
    '#1f6feb',
  ],
  [
    'kesh-html-v-protsesse',
    'Кеш HTML внутри процесса',
    'LRU в хуке против отдельного кеширующего слоя: что дешевле в эксплуатации.',
    ['cache', 'deploy'],
    '#8957e5',
  ],
  [
    '404-i-410',
    '404 и 410: честные коды вместо мягких ошибок',
    'Почему «200 + ничего не найдено» хуже любого четырёхсотого.',
    ['seo', 'http'],
    '#238636',
  ],
  [
    'fsd-na-servere',
    'FSD на сервере: слои переживают SSR',
    'Раскладка по слоям не мешает файловому роутингу, если знать нужные опции.',
    ['architecture'],
    '#da3633',
  ],
]

const body = (title) => `
## Зачем это нужно

${title} — тема, которую легко недооценить: она не видна в интерфейсе, но
определяет, попадёт ли страница в индекс и как быстро её увидит пользователь.

## Что проверяем

- первый байт содержит весь \`<head>\`: title, description, canonical, hreflang;
- основной контент присутствует в сыром HTML, без гидрации;
- коды ответов честные: 200 для существующего, 404 для отсутствующего;
- изображения отдаются в современных форматах и не двигают вёрстку.

### Практика

Любая проверка начинается с \`curl\`. Если в ответе нет \`<h1>\`, обсуждать
метрики бессмысленно — краулер тоже его не увидит.

\`\`\`sh
curl -s https://example.com/blog/slug | grep -o '<h1[^>]*>[^<]*'
\`\`\`

## Итог

Техническое SEO — это дисциплина повторяемых проверок, а не разовая настройка.
Каждое требование должно быть закрыто тестом в гейте, иначе оно рассыплется при
первом же рефакторинге.
`

await mkdir(coversDir, { recursive: true })

for (const [i, [slug, title, description, tags, color]] of posts.entries()) {
  const pub = new Date(Date.UTC(2026, 2 + Math.floor(i / 3), 3 + (i % 3) * 7))
    .toISOString()
    .slice(0, 10)
  const upd = new Date(Date.UTC(2026, 5 + Math.floor(i / 4), 5 + (i % 4) * 5))
    .toISOString()
    .slice(0, 10)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <rect width="1600" height="900" fill="${color}"/>
  <rect x="0" y="780" width="1600" height="120" fill="rgba(0,0,0,0.25)"/>
  <text x="80" y="420" font-family="DejaVu Sans, sans-serif" font-size="72" font-weight="700" fill="#ffffff">stit demo</text>
  <text x="80" y="510" font-family="DejaVu Sans, sans-serif" font-size="40" fill="rgba(255,255,255,0.85)">${slug}</text>
  <text x="80" y="855" font-family="DejaVu Sans, sans-serif" font-size="34" fill="rgba(255,255,255,0.8)">${pub}</text>
</svg>`
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(join(coversDir, `${slug}.png`))

  const md = `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
pubDate: ${pub}
updatedDate: ${upd}
cover: ./covers/${slug}.png
tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]
---
${body(title)}`
  await writeFile(join(contentDir, `${slug}.md`), md, 'utf8')
}

console.log(`generated ${posts.length} posts + covers`)
