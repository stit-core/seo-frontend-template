import { OG_DEFAULT_IMAGE } from '@/shared/config'
import { articleImagesOf, ogImageOf } from './images'

const master = { src: '/_astro/cover.png', width: 1600, height: 900, format: 'png' as const }

// В тестах адрес картинки — запрос преобразования к эндпоинту картинок: мастер, размеры, обрезка, формат.
const requestOf = (path: string) =>
  Object.fromEntries(new URLSearchParams(path.slice(path.indexOf('?') + 1)))

describe('картинки превью и разметки', () => {
  it('превью ссылки — кадр мастера размера карточки сайта, JPEG, с подписью', async () => {
    const og = await ogImageOf(master, 'Обложка записи')
    expect(og).toMatchObject({
      width: OG_DEFAULT_IMAGE.width,
      height: OG_DEFAULT_IMAGE.height,
      alt: 'Обложка записи',
    })
    expect(requestOf(og.path)).toMatchObject({
      href: master.src,
      w: String(OG_DEFAULT_IMAGE.width),
      h: String(OG_DEFAULT_IMAGE.height),
      fit: 'cover',
      f: 'jpg',
    })
  })

  // Безопасная зона мастера — его центр: кадр выбирает не детектор заметности, а правило автора.
  it('каждый кадр — по центру мастера', async () => {
    const paths = [(await ogImageOf(master, 'Обложка')).path]
    for (const { path } of await articleImagesOf(master)) paths.push(path)
    for (const path of paths) expect(requestOf(path)).not.toHaveProperty('position')
  })

  it('кадры разметки статьи — 16:9, 4:3 и 1:1 из того же мастера, JPEG, без растяжения', async () => {
    const frames = await articleImagesOf(master)
    expect(frames.map(({ width, height }) => width / height)).toEqual([16 / 9, 4 / 3, 1])
    for (const { path, width, height } of frames) {
      expect(width).toBeLessThanOrEqual(master.width)
      expect(height).toBeLessThanOrEqual(master.height)
      expect(requestOf(path)).toMatchObject({ href: master.src, fit: 'cover', f: 'jpg' })
    }
  })
})
