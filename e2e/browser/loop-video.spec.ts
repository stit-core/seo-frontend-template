import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Page } from '@playwright/test'
import type * as Astro from 'astro'
import { t } from '../../src/shared/i18n/dict.ts'
import { expect, test } from './csp'

// В reference-наборе сайта петли нет: страницу с ней собирает мини-проект на настоящих компонентах —
// примитиве LoopVideo, острове предпочтений и переключателе движения. Ролик — заглушка: важно, получил
// ли браузер хоть один ответ с ним, а не что он в нём показал.
const repo = resolve(import.meta.dirname, '../..')
const PAGE = `---
import LoopVideo from '${repo}/src/shared/ui/media/loop-video.astro'
import MotionToggle from '${repo}/src/features/preferences/ui/motion-toggle.astro'
import PreferencesInit from '${repo}/src/features/preferences/ui/preferences-init.astro'
const poster = { src: '/poster.png', width: 192, height: 192, format: 'png' }
const loop = (name) => [
  { src: \`/\${name}.mp4\`, type: 'video/mp4' },
  { src: \`/\${name}.webm\`, type: 'video/webm' },
]
---
<html lang="ru">
  <head><meta charset="utf-8" /><title>Петли</title><PreferencesInit /></head>
  <body>
    <LoopVideo lcp poster={poster} sources={loop('pervyy-ekran')} />
    <h1>Петли</h1>
    <MotionToggle locale="ru" />
    <div style="height: 2000vh"></div>
    <LoopVideo poster={poster} sources={loop('nizhe-ekrana')} />
  </body>
</html>
`

let server: Server | undefined
let site = ''
test.describe.configure({ mode: 'default' })

test.beforeAll(async () => {
  test.setTimeout(60_000)
  const { project, workerIndex } = test.info()
  // Мини-проект — в выходе прогона: Astro кладёт промежуточную сборку в рабочий каталог процесса, если
  // выход проекта вне его, и параллельные сборки воркеров столкнулись бы там.
  const root = join(project.outputDir, 'loop-video', `${project.name}-${workerIndex}`)
  mkdirSync(join(root, 'src/pages'), { recursive: true })
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'))
  writeFileSync(join(root, 'src/pages/index.astro'), PAGE)
  // `astro` в тестах — модуль типов: сборщик берётся из файла пакета.
  const { build } = (await import(
    pathToFileURL(join(repo, 'node_modules/astro/dist/core/index.js')).href
  )) as typeof Astro
  // Кеши — свои: общий node_modules — ссылка.
  await build({
    root,
    logLevel: 'silent',
    cacheDir: join(root, '.cache'),
    vite: { cacheDir: join(root, '.vite'), resolve: { alias: { '@': join(repo, 'src') } } },
  })
  const files: Record<string, [string, Buffer]> = {
    '/': ['text/html; charset=utf-8', readFileSync(join(root, 'dist/index.html'))],
    '/poster.png': ['image/png', readFileSync(join(repo, 'public/icon-192.png'))],
  }
  const video = Buffer.alloc(64 * 1024)
  server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://x').pathname
    const media = /\.(mp4|webm)$/.exec(path)?.[1]
    const [type, body] = media ? [`video/${media}`, video] : (files[path] ?? ['text/plain', null])
    response.writeHead(body ? 200 : 404, { 'content-type': type })
    response.end(body)
  })
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done))
  site = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(() => {
  server?.close()
})

// Ответы с роликом: адрес ролика, на который браузер получил ответ 2xx, — значит, ролик качался.
function videoResponses(page: Page) {
  const seen: string[] = []
  page.on('response', (response) => {
    const { pathname } = new URL(response.url())
    if (/\.(mp4|webm)$/.test(pathname) && response.ok()) seen.push(pathname)
  })
  return seen
}

const loaded = (page: Page, name: string) =>
  page.waitForResponse((response) => response.url().includes(name) && response.ok())

// Страница загружена, остров применил выбор, раскладка решила ленивую загрузку: два кадра после load.
const settled = (page: Page) =>
  page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  )

test.describe('система просит сократить движение', () => {
  test.use({ reducedMotion: 'reduce' })

  test('ни байта ролика; «полное» вопреки системе — петля первого экрана качается', async ({
    page,
  }) => {
    const videos = videoResponses(page)
    await page.goto(site)
    await settled(page)
    expect(videos).toEqual([])
    const first = loaded(page, 'pervyy-ekran')
    await page.getByRole('button', { name: t('ru', 'motion.full') }).click()
    await first
  })

  // Без скрипта ленивой загрузки нет (так требует HTML), и острова нет: ролик держит одно условие движения
  // у источников.
  test.describe('скрипта нет', () => {
    test.use({ javaScriptEnabled: false })

    test('ни байта ролика', async ({ page }) => {
      const videos = videoResponses(page)
      await page.goto(site, { waitUntil: 'networkidle' })
      expect(videos).toEqual([])
    })
  })
})

// «Меньше» снимает автозапуск — петли стоят. WebKit начинает загрузку петли с автозапуском ещё при разборе:
// атрибута loading у видео он не знает, и остров обрывает её только первым кадром — сколько байт успеет
// прийти, решает сеть (rule shared-ui). Поэтому состояние петель судят оба движка, байты — Chromium.
test('выбор «меньше» — петли стоят, ни байта ролика; «как в системе» — петля первого экрана качается', async ({
  page,
  browserName,
}) => {
  await page.addInitScript(() => localStorage.setItem('motion', 'reduced'))
  const videos = videoResponses(page)
  await page.goto(site)
  await settled(page)
  const loops = await page
    .locator('video')
    .evaluateAll((all: HTMLVideoElement[]) =>
      all.map(({ autoplay, paused }) => ({ autoplay, paused })),
    )
  expect(loops).toEqual([
    { autoplay: false, paused: true },
    { autoplay: false, paused: true },
  ])
  if (browserName !== 'webkit') expect(videos).toEqual([])
  const first = loaded(page, 'pervyy-ekran')
  await page.getByRole('button', { name: t('ru', 'motion.system') }).click()
  await first
})

test('петля первого экрана качается с загрузкой страницы, ниже экрана — когда до неё дошли', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'WebKit не знает loading у видео: петля качается с загрузки')
  const videos = videoResponses(page)
  const first = loaded(page, 'pervyy-ekran')
  await page.goto(site)
  await first
  await settled(page)
  expect(videos.filter((path) => path.includes('nizhe-ekrana'))).toEqual([])
  const below = loaded(page, 'nizhe-ekrana')
  await page.locator('video').last().scrollIntoViewIfNeeded()
  await below
})
