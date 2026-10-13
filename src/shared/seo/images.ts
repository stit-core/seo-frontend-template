import { getImage } from 'astro:assets'
import type { ImageMetadata } from 'astro'
import { OG_DEFAULT_IMAGE } from '@/shared/config'
import type { OgImage } from './meta'

// Картинки для превью ссылок и выдачи — кадры мастера записи в JPEG: его читает любая соцсеть,
// мессенджер и поисковик. Превью — размера карточки сайта (1200×630), кадры разметки статьи —
// пропорции, которые просит выдача Google (16:9, 4:3, 1:1). Кадр — обрезка без растяжения (мастер
// обложки 1600×900 крупнее каждого) по самой заметной области мастера (`attention` sharp), а не по
// центру: узкий кадр берёт предмет, а не середину картинки.
const ARTICLE_FRAMES = [
  { width: 1200, height: 675 },
  { width: 1200, height: 900 },
  { width: 900, height: 900 },
] as const

async function frame(master: ImageMetadata, width: number, height: number) {
  const { src } = await getImage({
    src: master,
    width,
    height,
    fit: 'cover',
    position: 'attention',
    format: 'jpg',
  })
  return { path: src, width, height }
}

export async function ogImageOf(master: ImageMetadata, alt: string): Promise<OgImage> {
  return { ...(await frame(master, OG_DEFAULT_IMAGE.width, OG_DEFAULT_IMAGE.height)), alt }
}

export const articleImagesOf = (master: ImageMetadata) =>
  Promise.all(ARTICLE_FRAMES.map(({ width, height }) => frame(master, width, height)))
