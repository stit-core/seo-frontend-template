import { spawnSync } from 'node:child_process'
import {
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

// SITE_URL — ровно origin. Одно правило для старта сервера и штамповки: путь, query, userinfo,
// пробелы, пустой хост, регистр и спецсимволы, включая инъекции в sed из аудита.
const NOT_AN_ORIGIN = [
  'demo.example',
  'localhost:3000',
  'mailto:a@b',
  'https://',
  'https://ex.com/sub',
  'https://ex.com?x=1',
  'https://ex.com/#x',
  'https://u:p@ex.com',
  'https://ex.com ',
  'HTTPS://EX.COM',
  'https://ex.com&',
  'https://ex.com|x',
  'https://ex.com\\',
  'https://ex.com\nfoo',
  'https://ex.com|;s|<head>|<head><script>alert(1)</script>|;#',
  'https://ex.com|g;w /tmp/stamp-w\n#',
]

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
    for (const SITE_URL of NOT_AN_ORIGIN) {
      const result = run({ SITE_URL })
      expect(result.status, SITE_URL).toBe(1)
      expect(result.stderr, SITE_URL).toContain('[server] invalid env — SITE_URL:')
    }
  })

  // Опечатки оператора из аудита: каждая раньше поднимала полуживой контейнер.
  it('опечатка в любом ключе — отказ с именем ключа, значение в лог не попадает', () => {
    const typos = {
      LOG_LEVEL: 'verbose',
      INDEXNOW_KEY: 'short',
      FORM_DELIVERY: 'email',
      ROBOTS_POLICY: 'Noindex',
      AI_TRAINING: 'blocked',
      SHUTDOWN_TIMEOUT_MS: '15s',
    }
    for (const [key, value] of Object.entries(typos)) {
      const result = run({ SITE_URL: 'https://demo.example', [key]: value })
      expect(result.status, key).toBe(1)
      expect(result.stderr, key).toContain(`[server] invalid env — ${key}:`)
      expect(result.stderr, key).not.toContain(value)
    }
  })
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

  it('SITE_URL — не origin: отказ до штамповки, данные из env не исполняются', () => {
    const html = `<link rel="canonical" href="${SITE_ORIGIN_PLACEHOLDER}/"><head>`
    withDist({ 'client/index.html': html }, (dist) => {
      const pwned = join(dist, 'pwned')
      for (const SITE_URL of [...NOT_AN_ORIGIN, `https://ex.com|;e touch ${pwned}\n#`]) {
        const result = run({ SITE_URL, DIST_DIR: dist })
        expect(result.status, SITE_URL).toBe(1)
        expect(result.stderr, SITE_URL).toContain('[entrypoint] invalid env — SITE_URL:')
        expect(read(dist, 'client/index.html'), SITE_URL).toBe(html)
      }
      expect(existsSync(pwned)).toBe(false)
    })
  })

  it('опечатка в другом ключе env — отказ до штамповки', () => {
    const html = `<a href="${SITE_ORIGIN_PLACEHOLDER}/en">`
    withDist({ 'client/index.html': html }, (dist) => {
      const result = run({ SITE_URL: 'https://demo.example', LOG_LEVEL: 'verbose', DIST_DIR: dist })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('[entrypoint] invalid env — LOG_LEVEL:')
      expect(read(dist, 'client/index.html')).toBe(html)
    })
  })

  it('без dist/client — отказ', () => {
    withDist({}, (dist) => {
      const result = run({ SITE_URL: 'https://demo.example', DIST_DIR: dist })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('client')
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
