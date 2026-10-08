import { spawn as spawnProcess, spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE_ORIGIN_PLACEHOLDER } from './runtime'

const repoFile = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url))

// Плейсхолдер живёт в файлах, которые не могут импортировать схему (TS-конфиг сборки, приёмка
// образа); тест держит их согласованными.
it('плейсхолдер origin согласован во всех файлах с литералом', () => {
  const literals = {
    'astro.config.ts': SITE_ORIGIN_PLACEHOLDER,
    'scripts/accept-image.sh': new URL(SITE_ORIGIN_PLACEHOLDER).hostname,
  }
  for (const [file, literal] of Object.entries(literals)) {
    expect(readFileSync(repoFile(file), 'utf8'), file).toContain(literal)
  }
})

// Модуль конфига серверной сборки (dist/server/runtime-config.mjs) без сборки: переотдаёт
// исходник схемы, типы Node снимает сам.
const writeConfigModule = (dist: string) => {
  mkdirSync(join(dist, 'server'), { recursive: true })
  const schema = JSON.stringify(repoFile('src/shared/config/runtime.ts'))
  writeFileSync(join(dist, 'server/runtime-config.mjs'), `export * from ${schema}\n`)
}

// Процесс под тестом обязан завершиться сам: сломанный fail-fast поднял бы сервер, и без
// таймаута гейт висел бы вместо красного теста.
const spawn = (command: string, args: string[], env: Record<string, string>) => {
  const result = spawnSync(command, args, {
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
    timeout: 5_000,
  })
  if (result.error) throw result.error
  return result
}

// Правило origin целиком держит юнит схемы (runtime.test.ts) — в процессе, без запуска Node.
// Здесь — что обёртка и entrypoint применяют именно его: по нескольку значений на процесс.
describe('docker/server.mjs: env целиком проверяется до загрузки приложения', () => {
  // Раскладка образа без сборки: обёртка и модуль конфига. Приложения в раскладке нет: дальше
  // проверки env процесс не уходит.
  let app = ''
  beforeAll(() => {
    app = mkdtempSync(join(tmpdir(), 'server-app-'))
    mkdirSync(join(app, 'docker'))
    cpSync(repoFile('docker/server.mjs'), join(app, 'docker/server.mjs'))
    writeConfigModule(join(app, 'dist'))
  })
  afterAll(() => rmSync(app, { recursive: true, force: true }))

  // Свободный порт на loopback: если сервер всё же поднимется, он никому не помешает.
  const run = (env: Record<string, string>) =>
    spawn(process.execPath, [join(app, 'docker/server.mjs')], {
      HOST: '127.0.0.1',
      PORT: '0',
      ...env,
    })

  it('не стартует без SITE_URL, с пустым SITE_URL и с плейсхолдером сборки', () => {
    for (const env of [{}, { SITE_URL: '' }, { SITE_URL: SITE_ORIGIN_PLACEHOLDER }]) {
      const result = run(env)
      expect(result.status, JSON.stringify(env)).toBe(1)
      expect(result.stderr, JSON.stringify(env)).toContain('[server] invalid env — SITE_URL:')
      expect(result.stderr, JSON.stringify(env)).toContain('placeholder')
    }
  })

  it('не стартует, если SITE_URL — не origin', () => {
    for (const SITE_URL of ['https://ex.com/sub', 'https://u:p@ex.com', 'https://ex.com|x']) {
      const result = run({ SITE_URL })
      expect(result.status, SITE_URL).toBe(1)
      expect(result.stderr, SITE_URL).toContain('[server] invalid env — SITE_URL:')
    }
  })

  // Опечатки оператора в значениях enum, ключа IndexNow и таймаута: без проверки при старте —
  // полуживой контейнер.
  it('значения вне формата — отказ: строка называет каждый ключ, значений в ней нет', () => {
    const typos = {
      LOG_LEVEL: 'verbose',
      INDEXNOW_KEY: 'short',
      FORM_DELIVERY: 'email',
      ROBOTS_POLICY: 'Noindex',
      SHUTDOWN_TIMEOUT_MS: '15s',
    }
    const result = run({ SITE_URL: 'https://demo.example', ...typos })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('[server] invalid env — ')
    for (const [key, value] of Object.entries(typos)) {
      expect(result.stderr, key).toContain(`${key}:`)
      expect(result.stderr, key).not.toContain(value)
    }
  })
})

// Заглушка адаптера: слушатель бросает до отправки заголовков и после неё. У настоящего адаптера
// есть только первый путь (его держит HTTP-набор), перехват обязан пережить оба.
const THROWING_ADAPTER = `import { createServer } from 'node:http'
export function startServer() {
  const server = createServer((request, response) => {
    if (request.url === '/before') throw new TypeError('до заголовков')
    if (request.url === '/after') {
      response.writeHead(200).write('начало')
      throw new TypeError('после заголовков')
    }
    response.end('ok')
  })
  server.listen(0, '127.0.0.1', () => console.log('port=' + server.address().port))
  return { server: { server }, done: new Promise(() => {}) }
}
`

describe('docker/server.mjs: исключение слушателя адаптера не завершает процесс', () => {
  it('до заголовков — 400, после — разрыв соединения, следующий запрос отвечает', async () => {
    const app = mkdtempSync(join(tmpdir(), 'server-guard-'))
    mkdirSync(join(app, 'docker'))
    cpSync(repoFile('docker/server.mjs'), join(app, 'docker/server.mjs'))
    writeConfigModule(join(app, 'dist'))
    writeFileSync(join(app, 'dist/server/entry.mjs'), THROWING_ADAPTER)
    const server = spawnProcess(process.execPath, [join(app, 'docker/server.mjs')], {
      env: { PATH: process.env.PATH ?? '', SITE_URL: 'https://demo.example' },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    try {
      // Срок на подъём и на каждый запрос: зависший процесс или повисший ответ — красный тест, а
      // не подвешенный гейт.
      const origin = await new Promise<string>((done, fail) => {
        const late = setTimeout(() => fail(new Error('обёртка не поднялась за 4 с')), 4_000)
        server.stdout.on('data', (chunk: Buffer) => {
          const port = /port=(\d+)/.exec(String(chunk))?.[1]
          if (port) {
            clearTimeout(late)
            done(`http://127.0.0.1:${port}`)
          }
        })
        server.once('exit', (code) => fail(new Error(`обёртка вышла с кодом ${String(code)}`)))
      })
      const get = (path: string) =>
        fetch(`${origin}${path}`, { signal: AbortSignal.timeout(2_000) })
      const refused = await get('/before')
      expect(refused.status).toBe(400)
      expect(await refused.text()).toBe('Bad request')
      const broken: unknown = await get('/after')
        .then((response) => response.text())
        .catch((error: unknown) => error)
      // Соединение разорвано, а не оставлено висеть до срока запроса.
      expect(broken).toBeInstanceOf(Error)
      expect(broken).not.toHaveProperty('name', 'TimeoutError')
      expect(await (await get('/ok')).text()).toBe('ok')
    } finally {
      server.kill()
      rmSync(app, { recursive: true, force: true })
    }
  }, 15_000)
})

describe('docker/entrypoint.sh: SITE_URL по схеме, штамповка dist/client', () => {
  const run = (env: Record<string, string>, command = ['true']) =>
    spawn('sh', [repoFile('docker/entrypoint.sh'), ...command], env)

  const withDist = (files: Record<string, string>, fn: (dist: string) => void) => {
    const dist = mkdtempSync(join(tmpdir(), 'entrypoint-dist-'))
    try {
      writeConfigModule(dist)
      for (const [name, content] of Object.entries(files)) {
        mkdirSync(dirname(join(dist, name)), { recursive: true })
        writeFileSync(join(dist, name), content)
      }
      fn(dist)
    } finally {
      rmSync(dist, { recursive: true, force: true })
    }
  }

  const read = (dist: string, name: string) => readFileSync(join(dist, name), 'utf8')

  it('не запускает команду без SITE_URL, с пустым и с плейсхолдером сборки', () => {
    withDist({ 'client/index.html': '' }, (dist) => {
      for (const env of [{}, { SITE_URL: '' }, { SITE_URL: SITE_ORIGIN_PLACEHOLDER }]) {
        const result = run({ DIST_DIR: dist, ...env })
        expect(result.status, JSON.stringify(env)).toBe(1)
        expect(result.stderr, JSON.stringify(env)).toContain('[entrypoint] invalid env — SITE_URL:')
        expect(result.stderr, JSON.stringify(env)).toContain('placeholder')
      }
    })
  })

  // Строки, которыми атакуют подстановку origin в разметку: команды sed (`e`, `w`) и вставка
  // `<script>`.
  it('SITE_URL — не origin: отказ до штамповки, данные из env не исполняются', () => {
    const html = `<link rel="canonical" href="${SITE_ORIGIN_PLACEHOLDER}/"><head>`
    withDist({ 'client/index.html': html }, (dist) => {
      const pwned = join(dist, 'pwned')
      for (const SITE_URL of [
        'https://ex.com|;s|<head>|<head><script>alert(1)</script>|;#',
        `https://ex.com|g;w ${pwned}\n#`,
        `https://ex.com|;e touch ${pwned}\n#`,
      ]) {
        const result = run({ SITE_URL, DIST_DIR: dist })
        expect(result.status, SITE_URL).toBe(1)
        expect(result.stderr, SITE_URL).toContain('[entrypoint] invalid env — SITE_URL:')
        expect(read(dist, 'client/index.html'), SITE_URL).toBe(html)
      }
      expect(existsSync(pwned)).toBe(false)
    })
  })

  it('значение вне формата в другом ключе — отказ до штамповки', () => {
    const html = `<a href="${SITE_ORIGIN_PLACEHOLDER}/en">`
    withDist({ 'client/index.html': html }, (dist) => {
      const result = run({ SITE_URL: 'https://demo.example', LOG_LEVEL: 'verbose', DIST_DIR: dist })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('[entrypoint] invalid env — LOG_LEVEL:')
      expect(read(dist, 'client/index.html')).toBe(html)
    })
  })

  it('без выхода сборки — отказ: dist/client нет или он пуст (том поверх образа)', () => {
    for (const files of [{}, { 'client/.keep': '' }]) {
      withDist(files, (dist) => {
        const result = run({ SITE_URL: 'https://demo.example', DIST_DIR: dist }, ['echo', 'up'])
        expect(result.status, JSON.stringify(files)).toBe(1)
        expect(result.stderr).toContain('[entrypoint]')
        expect(result.stderr).toContain('build output is missing or empty')
        expect(result.stdout).not.toContain('up')
      })
    }
  })

  // root пишет мимо прав файла: для него отказ записи так не воспроизвести.
  const root = process.getuid?.() === 0
  it.skipIf(root)('запись без прав — отказ строкой с причиной, без стека', () => {
    withDist({ 'client/index.html': `<a href="${SITE_ORIGIN_PLACEHOLDER}/">` }, (dist) => {
      chmodSync(join(dist, 'client/index.html'), 0o444)
      const result = run({ SITE_URL: 'https://demo.example', DIST_DIR: dist })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('[entrypoint] cannot stamp index.html: EACCES')
      expect(result.stderr).not.toMatch(/^\s+at /m)
    })
  })

  it('штампует html/xml/txt в dist/client, dist/server не трогает, срезает все хвостовые слеши', () => {
    withDist(
      {
        'client/index.html': `<link href="${SITE_ORIGIN_PLACEHOLDER}/en"><a href="${SITE_ORIGIN_PLACEHOLDER}/">`,
        'client/en/index.html': `<link href="${SITE_ORIGIN_PLACEHOLDER}/">`,
        'client/sitemap.xml': `<loc>${SITE_ORIGIN_PLACEHOLDER}/</loc>`,
        'client/robots.txt': `Sitemap: ${SITE_ORIGIN_PLACEHOLDER}/sitemap.xml`,
        'server/entry.mjs': `const site = "${SITE_ORIGIN_PLACEHOLDER}"`,
      },
      (dist) => {
        const result = run({ SITE_URL: 'https://demo.example//', DIST_DIR: dist })
        expect(result.status, result.stderr).toBe(0)
        expect(result.stdout).toContain('stamped')
        expect(read(dist, 'client/index.html')).toBe(
          '<link href="https://demo.example/en"><a href="https://demo.example/">',
        )
        expect(read(dist, 'client/en/index.html')).toBe('<link href="https://demo.example/">')
        expect(read(dist, 'client/sitemap.xml')).toBe('<loc>https://demo.example/</loc>')
        expect(read(dist, 'client/robots.txt')).toBe('Sitemap: https://demo.example/sitemap.xml')
        expect(read(dist, 'server/entry.mjs')).toContain(SITE_ORIGIN_PLACEHOLDER)
      },
    )
  })

  // Last-Modified и ETag статик-хендлера считаются от mtime: штамповка не делает страницу
  // «изменённой», а файл без плейсхолдера не переписывается вовсе.
  it('mtime сборки сохраняется, файл без плейсхолдера не переписывается', () => {
    withDist(
      {
        'client/index.html': `<link href="${SITE_ORIGIN_PLACEHOLDER}/">`,
        'client/about/index.html': '<a href="/">',
      },
      (dist) => {
        const built = new Date('2026-01-02T03:04:05.678Z')
        for (const name of ['client/index.html', 'client/about/index.html']) {
          utimesSync(join(dist, name), built, built)
        }
        const untouched = statSync(join(dist, 'client/about/index.html')).ctimeMs
        expect(run({ SITE_URL: 'https://demo.example', DIST_DIR: dist }).status).toBe(0)
        expect(read(dist, 'client/index.html')).toBe('<link href="https://demo.example/">')
        expect(statSync(join(dist, 'client/index.html')).mtime).toEqual(built)
        expect(statSync(join(dist, 'client/about/index.html')).mtime).toEqual(built)
        expect(statSync(join(dist, 'client/about/index.html')).ctimeMs).toBe(untouched)
      },
    )
  })

  it('остаток плейсхолдера в неучтённом файле — отказ после штамповки', () => {
    withDist(
      {
        'client/index.html': SITE_ORIGIN_PLACEHOLDER,
        'client/_astro/app.css': `url(${SITE_ORIGIN_PLACEHOLDER}/bg.png)`,
      },
      (dist) => {
        const result = run({ SITE_URL: 'https://demo.example', DIST_DIR: dist })
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('placeholder left')
        expect(result.stderr).toContain('app.css')
        expect(read(dist, 'client/index.html')).toBe('https://demo.example')
      },
    )
  })

  it('повторный запуск на проштампованном dist — норма, файлы не переписываются', () => {
    withDist({ 'client/index.html': `<a href="${SITE_ORIGIN_PLACEHOLDER}/en">` }, (dist) => {
      const env = { SITE_URL: 'https://demo.example', DIST_DIR: dist }
      expect(run(env).status).toBe(0)
      const stamped = read(dist, 'client/index.html')
      const { ctimeMs } = statSync(join(dist, 'client/index.html'))
      const again = run(env)
      expect(again.status, again.stderr).toBe(0)
      expect(read(dist, 'client/index.html')).toBe(stamped)
      expect(statSync(join(dist, 'client/index.html')).ctimeMs).toBe(ctimeMs)
    })
  })

  it('команда заменяет процесс entrypoint (exec): сигналы контейнера доходят до node', () => {
    withDist({ 'client/index.html': '' }, (dist) => {
      const result = run({ SITE_URL: 'https://demo.example', DIST_DIR: dist }, [
        'sh',
        '-c',
        'echo "pid=$$"',
      ])
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(`pid=${result.pid}`)
    })
  })

  it('код выхода команды — код выхода контейнера', () => {
    withDist({ 'client/index.html': '' }, (dist) => {
      const result = run({ SITE_URL: 'https://demo.example', DIST_DIR: dist }, [
        'sh',
        '-c',
        'exit 3',
      ])
      expect(result.status).toBe(3)
    })
  })
})
