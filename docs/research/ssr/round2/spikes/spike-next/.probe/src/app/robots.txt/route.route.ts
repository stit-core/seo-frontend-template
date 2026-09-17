export const dynamic = 'force-dynamic'
export function GET() {
  return new Response('User-Agent: *\nAllow: /\n', { headers: { 'content-type': 'text/plain' } })
}
