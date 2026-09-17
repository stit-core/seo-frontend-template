import { getAllPosts } from '@/entities/post'
import { getSiteUrl } from '@/shared/config'
import { DEFAULT_LOCALE, localePath } from '@/shared/i18n'

export const dynamic = 'force-dynamic'

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET() {
  const siteUrl = getSiteUrl()
  const posts = await getAllPosts(DEFAULT_LOCALE)

  const items = posts
    .map((post) => {
      const url = `${siteUrl}${localePath(DEFAULT_LOCALE, `/blog/${post.slug}`)}`
      return `<item><title>${escapeXml(post.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(post.pubDate).toUTCString()}</pubDate><description>${escapeXml(post.description)}</description></item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>stit demo</title><link>${siteUrl}</link><description>spike</description>${items}</channel></rss>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=600',
    },
  })
}
