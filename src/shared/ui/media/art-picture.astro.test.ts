import { readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { Browser } from 'happy-dom'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import ArtPicture from './art-picture.astro'

const astro = await AstroContainer.create()

type Format = 'avif' | 'webp' | 'jpg'
const file = (name: string, width: number, height: number, format: Format = 'avif') => ({
  src: `/_astro/${name}.${format}`,
  width,
  height,
  format,
})
// Кадр по умолчанию — 16:9 лестницей ширин, кадр телефона — свой мастер 4:5.
const desktop = [
  file('hero-1280', 1280, 720),
  file('hero-1920', 1920, 1080),
  file('hero-1280', 1280, 720, 'webp'),
  file('hero-1920', 1920, 1080, 'webp'),
]
const mobile = [file('hero-4x5', 1080, 1350), file('hero-4x5', 1080, 1350, 'webp')]
const sizes = '100vw'

const render = (props: Record<string, unknown>) =>
  astro.renderToString(ArtPicture, { props: { alt: '', desktop, sizes, ...props } })

// Граница телефона — граница раскладки tablet файла токенов (rem от 16 px корня).
const tablet =
  16 *
  Number(
    /--breakpoint-tablet:\s*([\d.]+)rem/.exec(
      readFileSync(new URL('../../../app/styles/tokens.css', import.meta.url), 'utf8'),
    )?.[1],
  )

const browsers: Browser[] = []
afterAll(() => Promise.all(browsers.map((browser) => browser.close())))

// Какой файл возьмёт браузер окна этой ширины: первый источник, чьё условие `media` выполнено, иначе
// <img>; из srcset — кандидат по ширине слота и плотности экрана.
function chosen(html: string, width: number, density = 1) {
  const browser = new Browser()
  browsers.push(browser)
  const page = browser.newPage()
  page.setViewport({ width, height: 900, devicePixelRatio: density })
  page.content = html
  const { window, document } = page.mainFrame
  const source = [...document.querySelectorAll('source')].find(
    (item) => !item.media || window.matchMedia(item.media).matches,
  )
  const element = source ?? document.querySelector('img')
  const candidates = (element?.getAttribute('srcset') ?? '').split(', ').map((item) => {
    const [url = '', descriptor = ''] = item.split(' ')
    return { url, width: Number.parseInt(descriptor, 10) }
  })
  const need = width * density
  const fit = candidates.filter((candidate) => candidate.width >= need)
  const pick = fit.length > 0 ? fit : candidates.slice(-1)
  return {
    url: pick.reduce((best, candidate) => (candidate.width < best.width ? candidate : best)).url,
    reserved: [element?.getAttribute('width'), element?.getAttribute('height')].map(Number),
  }
}

describe('ArtPicture', () => {
  it('файлы — как есть: srcset из их адресов и ширин, <img> — крупнейший WebP кадра с размерами', async () => {
    const html = await render({})
    const doc = parseHtml(html)
    const [source] = doc.querySelectorAll('source')
    const img = doc.querySelector('img')
    expect(source?.getAttribute('type')).toBe('image/avif')
    expect(source?.getAttribute('srcset')).toBe(
      '/_astro/hero-1280.avif 1280w, /_astro/hero-1920.avif 1920w',
    )
    expect(img?.getAttribute('src')).toBe('/_astro/hero-1920.webp')
    expect(img?.getAttribute('srcset')).toBe(
      '/_astro/hero-1280.webp 1280w, /_astro/hero-1920.webp 1920w',
    )
    expect([img?.getAttribute('width'), img?.getAttribute('height')]).toEqual(['1920', '1080'])
    for (const element of [source, img]) expect(element?.getAttribute('sizes')).toBe(sizes)
    expect(html).not.toContain('/_image')
  })

  it('кадр телефона — на окне у́же границы tablet, со своими размерами; шире — кадр по умолчанию', async () => {
    const html = await render({ mobile })
    expect(chosen(html, tablet - 1, 3)).toEqual({
      url: '/_astro/hero-4x5.avif',
      reserved: [1080, 1350],
    })
    expect(chosen(html, tablet).url).toBe('/_astro/hero-1280.avif')
    expect(chosen(html, 1280, 2)).toEqual({ url: '/_astro/hero-1920.avif', reserved: [1920, 1080] })
    // Каждый источник кадра телефона несёт свои размеры: место резервирует его пропорция.
    const phone = [...parseHtml(html).querySelectorAll('source[media]')]
    expect(phone.map((source) => source.getAttribute('type'))).toEqual(['image/avif', 'image/webp'])
    for (const source of phone) {
      expect([source.getAttribute('width'), source.getAttribute('height')]).toEqual([
        '1080',
        '1350',
      ])
    }
  })

  it('роль слота: кандидат в LCP — сразу и с приоритетом, остальное — лениво', async () => {
    const lcp = parseHtml(await render({ lcp: true })).querySelector('img')
    expect(lcp?.getAttribute('loading')).not.toBe('lazy')
    expect(lcp?.getAttribute('fetchpriority')).toBe('high')
    const rest = parseHtml(await render({})).querySelector('img')
    expect(rest?.getAttribute('loading')).toBe('lazy')
    expect(rest?.hasAttribute('fetchpriority')).toBe(false)
    expect(rest?.getAttribute('decoding')).toBe('async')
  })

  it.each([
    ['без WebP', { desktop: desktop.filter((item) => item.format === 'avif') }, 'desktop'],
    ['без AVIF', { mobile: mobile.filter((item) => item.format === 'webp') }, 'mobile'],
    [
      'с файлом другого формата',
      { desktop: [...desktop, file('hero', 1920, 1080, 'jpg')] },
      'desktop',
    ],
    ['с файлом другой пропорции', { mobile: [...mobile, file('hero-1x1', 1080, 1080)] }, 'mobile'],
  ])('кадр %s — ошибка сборки, названа роль кадра', async (_, props, frame) => {
    await expect(render(props)).rejects.toThrow(`кадр ${frame}`)
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render({ alt: 'Мастерская на рассвете', mobile }))
  })
})
