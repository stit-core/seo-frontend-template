import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const contentDir = resolve(here, '../src/entities/post/content')
const coverDir = resolve(contentDir, 'covers')
mkdirSync(coverDir, { recursive: true })

const posts = [
  [
    'prerender-po-umolchaniyu',
    'Prerender по умолчанию',
    'Почему статика по умолчанию — правильная точка отсчёта для контентного сайта.',
    '#1f2937',
  ],
  [
    'ostrova-vmesto-gidracii',
    'Острова вместо гидрации всей страницы',
    'Частичная гидрация даёт интерактив там, где он нужен, и ноль JS там, где не нужен.',
    '#0f766e',
  ],
  [
    'kanon-canonical',
    'Канон canonical',
    'Абсолютный self-canonical, никаких кросс-доменных ссылок и один хоп нормализации.',
    '#7c2d12',
  ],
  [
    'hreflang-bez-boli',
    'hreflang без боли',
    'Взаимные альтернативы, x-default и почему авто-редиректы по Accept-Language вредны.',
    '#4c1d95',
  ],
  [
    'kartinki-avif-webp',
    'Картинки: AVIF, WebP и srcset',
    'Как выдавать современные форматы и не ломать индексацию картинок.',
    '#155e75',
  ],
  [
    'shrifty-self-host',
    'Шрифты: self-host и unicode-range',
    'Сабсеттинг кириллицы, font-display и метрики фолбэка.',
    '#831843',
  ],
  [
    'sitemap-i-robots',
    'sitemap.xml и robots.txt',
    'Только 200-URL, свой origin, честный lastmod и Sitemap-строка.',
    '#166534',
  ],
  [
    '404-i-410',
    'Честные 404 и 410',
    'Почему «200 + ничего не найдено» хуже, чем отсутствие страницы.',
    '#b45309',
  ],
  [
    'keshirovanie-bez-cdn',
    'Кеширование без CDN',
    'Серверный кеш ответов, stale-while-revalidate и инвалидация по тегам.',
    '#1e3a8a',
  ],
  [
    'json-ld-tolko-vidimoe',
    'JSON-LD только про видимое',
    'Structured data описывает то, что есть на странице, и валидируется тестом.',
    '#3f6212',
  ],
  [
    'core-web-vitals-servera',
    'Core Web Vitals начинаются на сервере',
    'TTFB, отсутствие render-blocking и стабильный layout.',
    '#701a75',
  ],
  [
    'staging-noindex',
    'Staging и noindex',
    'Три контура защиты: basic-auth, X-Robots-Tag и Disallow.',
    '#0c4a6e',
  ],
]

const body = (title) => `
## Зачем это нужно

${title} — не абстракция, а набор проверяемых требований. Ниже — то, что мы
реально гоняем в тестах шаблона.

## Что проверяем

- первый HTML содержит весь значимый текст без JavaScript;
- \`<head>\` резолвится до первого байта;
- статусы честные: 200 там, где контент есть, и 404 там, где его нет;
- размер документа укладывается в бюджет.

## Как это выглядит в коде

\`\`\`ts
export const prerender = true
\`\`\`

Схема контента типизирована, поэтому опечатка во frontmatter ломает сборку,
а не выдачу. Это дешевле, чем ловить её в Search Console.

## Итог

Контентный сайт выигрывает не за счёт фреймворка, а за счёт дисциплины:
меньше клиентского кода, больше предсказуемости на сервере.
`

const pad = (n) => String(n).padStart(2, '0')

for (const [index, [slug, title, description, color]] of posts.entries()) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <rect width="1600" height="900" fill="${color}"/>
  <rect x="80" y="620" width="1440" height="8" fill="#ffffff" opacity="0.35"/>
  <text x="80" y="520" font-family="sans-serif" font-size="88" font-weight="700" fill="#ffffff">${title.replace(/&/g, '&amp;')}</text>
  <text x="80" y="720" font-family="sans-serif" font-size="40" fill="#ffffff" opacity="0.8">stit demo</text>
</svg>`
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(resolve(coverDir, `${slug}.png`))

  const day = pad((index % 27) + 1)
  const month = pad((index % 9) + 1)
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `pubDate: 2026-${month}-${day}`,
    index % 3 === 0 ? `updatedDate: 2026-09-${pad((index % 28) + 1)}` : null,
    `cover: ./covers/${slug}.png`,
    `tags: [${index % 2 === 0 ? '"rendering", "seo"' : '"seo", "performance"'}]`,
    '---',
    '',
  ]
    .filter((line) => line !== null)
    .join('\n')

  writeFileSync(resolve(contentDir, `${slug}.md`), `${frontmatter}${body(title)}`)
}

console.info(`generated ${posts.length} posts + covers`)
