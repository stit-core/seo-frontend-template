// минимальный прод-сервер: SolidStart 2 не поставляет своего (проверка для бенчмарка)
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import handler from './dist/server/entry-server.js'

const CLIENT = new URL('./dist/client/', import.meta.url).pathname
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' }

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const file = join(CLIENT, url.pathname)
  try {
    const s = await stat(file)
    if (s.isFile()) {
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(await readFile(file))
      return
    }
  } catch {}
  const request = new Request(url, { method: req.method, headers: req.headers })
  const response = await handler.fetch(request)
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
})
server.listen(Number(process.env.PORT ?? 3207), '127.0.0.1', () => console.log('listening', process.env.PORT ?? 3207))
