import { defineEventHandler, setResponseHeader } from 'h3'

// Staging закрывается заголовком, а не только robots.txt — три контура канона SEO.
export default defineEventHandler((event) => {
  if (process.env.ROBOTS_POLICY === 'noindex') {
    setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
  }
})
