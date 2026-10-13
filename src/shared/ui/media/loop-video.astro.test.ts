import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { Browser } from 'happy-dom'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import LoopVideo from './loop-video.astro'

const astro = await AstroContainer.create()

const poster = { src: '/_astro/loop.avif', width: 1920, height: 1080, format: 'avif' }
const sources = [
  { src: '/_astro/loop.av1.mp4', type: 'video/mp4; codecs="av01.0.08M.10"' },
  { src: '/_astro/loop.h264.mp4', type: 'video/mp4; codecs="avc1.640032"' },
]

const render = (props: { lcp?: boolean } = {}) =>
  astro.renderToString(LoopVideo, { props: { poster, sources, ...props } })

const browsers: Browser[] = []
afterAll(() => Promise.all(browsers.map((browser) => browser.close())))

// Какой ролик выберет браузер: первый источник, чьё условие `media` выполнено при этой настройке
// движения и ширине окна; нет такого — ни байта ролика, виден постер.
function chosen(html: string, { reduce = false, width = 1280 } = {}) {
  const browser = new Browser({
    settings: { device: { prefersReducedMotion: reduce ? 'reduce' : 'no-preference' } },
  })
  browsers.push(browser)
  const page = browser.newPage()
  page.setViewport({ width, height: 900 })
  page.content = html
  const { window, document } = page.mainFrame
  return [...document.querySelectorAll('source')]
    .find((source) => window.matchMedia(source.media).matches)
    ?.getAttribute('src')
}

describe('LoopVideo', () => {
  // Автозапуск сильнее preload: петля качается целиком, как только браузер её запускает. Ленивая загрузка
  // откладывает запуск до приближения к экрану, а без автозапуска («меньше») ролик ждёт и не качается.
  it('петля без звука качается у экрана: постер — кадр 0, размеры ролика — его', async () => {
    const video = parseHtml(await render()).querySelector('video')
    for (const flag of ['autoplay', 'muted', 'loop', 'playsinline']) {
      expect(video?.hasAttribute(flag)).toBe(true)
    }
    expect(video?.getAttribute('loading')).toBe('lazy')
    expect(video?.getAttribute('preload')).toBe('none')
    expect(video?.getAttribute('poster')).toBe('/_astro/loop.avif')
    expect([video?.getAttribute('width'), video?.getAttribute('height')]).toEqual(['1920', '1080'])
    expect(video?.hasAttribute('src')).toBe(false)
  })

  // Петля первого экрана ленивой загрузкой ждала бы раскладки, а с ней и постер — кандидат в LCP. Приоритет
  // постеру даёт preload: своего fetchpriority у него нет.
  it('роль слота: петля первого экрана — сразу, постер — с приоритетом; без роли — лениво и без preload', async () => {
    const first = parseHtml(await render({ lcp: true }))
    expect(first.querySelector('video')?.hasAttribute('loading')).toBe(false)
    const preload = first.querySelector('link')
    expect(
      ['rel', 'as', 'href', 'fetchpriority'].map((name) => preload?.getAttribute(name)),
    ).toEqual(['preload', 'image', '/_astro/loop.avif', 'high'])
    const rest = parseHtml(await render())
    expect(rest.querySelector('video')?.getAttribute('loading')).toBe('lazy')
    expect(rest.querySelector('link')).toBeNull()
  })

  it('при системном сокращении движения браузер не выбирает ни одного ролика', async () => {
    const html = await render()
    for (const width of [390, 1280]) expect(chosen(html, { reduce: true, width })).toBeUndefined()
  })

  // Место под роликом резервирует постер, а он один на все окна: ролик другой пропорции на узком окне
  // растянул бы бокс, когда придут данные ролика, и сдвинул всё, что ниже.
  it('на любом окне браузер берёт тот же ролик — пропорции постера', async () => {
    const html = await render()
    for (const width of [320, 390, 639, 640, 1280]) {
      expect(chosen(html, { width })).toBe('/_astro/loop.av1.mp4')
    }
  })

  it('ролик, который браузер не сыграет, он пропускает по типу с кодеком', async () => {
    const types = [...parseHtml(await render()).querySelectorAll('source')].map((source) =>
      source.getAttribute('type'),
    )
    expect(types).toEqual(sources.map(({ type }) => type))
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render())
  })
})
