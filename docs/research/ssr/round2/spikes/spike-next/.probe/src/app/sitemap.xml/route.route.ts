export const dynamic = 'force-dynamic'
export function GET() {
  return new Response('<?xml version="1.0"?><urlset/>', { headers: { 'content-type': 'application/xml' } })
}
