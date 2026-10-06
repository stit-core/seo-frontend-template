import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE_ORIGIN_PLACEHOLDER } from './runtime'

const repoFile = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url))

// Плейсхолдер живёт в файлах, которые не могут импортировать друг друга (TS-конфиг сборки,
// shell, приёмка образа); тест держит их согласованными.
it('плейсхолдер origin согласован во всех файлах с литералом', () => {
  const literals = {
    'astro.config.ts': SITE_ORIGIN_PLACEHOLDER,
    'docker/entrypoint.sh': SITE_ORIGIN_PLACEHOLDER,
    'scripts/accept-image.sh': new URL(SITE_ORIGIN_PLACEHOLDER).hostname,
  }
  for (const [file, literal] of Object.entries(literals)) {
    expect(readFileSync(repoFile(file), 'utf8'), file).toContain(literal)
  }
})

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

describe('docker/server.mjs: env целиком проверяется до загрузки приложения', () => {
  // Раскладка образа без сборки: обёртка и модуль конфига серверной сборки, который здесь
  // переотдаёт исходник схемы (Node снимает типы сам). Приложения в раскладке нет: дальше
  // проверки env процесс не уходит.
  let app = ''
  beforeAll(() => {
    app = mkdtempSync(join(tmpdir(), 'server-app-'))
    mkdirSync(join(app, 'docker'))
    mkdirSync(join(app, 'dist/server'), { recursive: true })
    cpSync(repoFile('docker/server.mjs'), join(app, 'docker/server.mjs'))
    const schema = JSON.stringify(repoFile('src/shared/config/runtime.ts'))
    writeFileSync(join(app, 'dist/server/runtime-config.mjs'), `export * from ${schema}\n`)
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

  it('не стартует с SITE_URL без схемы http(s)', () => {
    for (const SITE_URL of ['demo.example', 'localhost:3000', 'mailto:a@b']) {
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

describe('docker/entrypoint.sh: SITE_URL обязателен, штамповка dist/client', () => {
  const run = (env: Record<string, string>, command = ['true']) =>
    spawn('sh', [repoFile('docker/entrypoint.sh'), ...command], env)

  const withDist = (files: Record<string, string>, fn: (dist: string) => void) => {
    const dist = mkdtempSync(join(tmpdir(), 'entrypoint-dist-'))
    try {
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

  it('не запускает команду без SITE_URL, с пустым и без схемы http(s)', () => {
    withDist({ 'client/index.html': '' }, (dist) => {
      for (const env of [{}, { SITE_URL: '' }, { SITE_URL: 'demo.example' }]) {
        const result = run({ DIST_DIR: dist, ...env })
        expect(result.status, JSON.stringify(env)).toBe(1)
        expect(result.stderr, JSON.stringify(env)).toContain('[entrypoint] SITE_URL')
      }
    })
  })

  it('не запускает команду с плейсхолдером сборки', () => {
    withDist({ 'client/index.html': '' }, (dist) => {
      const result = run({ SITE_URL: SITE_ORIGIN_PLACEHOLDER, DIST_DIR: dist })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('placeholder')
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

  it('повторный запуск на проштампованном dist — норма', () => {
    withDist({ 'client/index.html': `<a href="${SITE_ORIGIN_PLACEHOLDER}/en">` }, (dist) => {
      const env = { SITE_URL: 'https://demo.example', DIST_DIR: dist }
      expect(run(env).status).toBe(0)
      const stamped = read(dist, 'client/index.html')
      const again = run(env)
      expect(again.status, again.stderr).toBe(0)
      expect(read(dist, 'client/index.html')).toBe(stamped)
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
