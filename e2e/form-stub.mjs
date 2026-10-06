// Приёмник заявок для e2e: канал доставки FORM_DELIVERY=backend не должен ходить наружу.
// POST /leads — принять заявку (адрес, начинающийся с fail-, отвергается: так проверяется
// отказ канала), GET /received — список адресов доставленных заявок. Порт выбирает конфиг
// Playwright (свободный на машине).
import { createServer } from 'node:http'

const PORT = Number(process.env.FORM_STUB_PORT)
const received = []

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/leads') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      let lead
      try {
        lead = JSON.parse(body)
      } catch {
        json(res, 400, { error: 'not json' })
        return
      }
      if (String(lead.email).startsWith('fail-')) {
        json(res, 502, { error: 'channel down' })
        return
      }
      received.push(lead.email)
      json(res, 202, { ok: true })
    })
    return
  }
  if (req.method === 'GET' && req.url === '/received') {
    json(res, 200, received)
    return
  }
  json(res, 404, { error: 'not found' })
}).listen(PORT, '127.0.0.1', () => {
  console.info(`[form-stub] listening on http://127.0.0.1:${PORT}`)
})
