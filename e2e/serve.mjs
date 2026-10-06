// Сервер прогона — как контейнер: копия сборки в раскладке образа (/app/{dist,docker,
// node_modules}), штамповка docker/entrypoint.sh и обёртка docker/server.mjs. Копия, а не dist/
// на месте: сборка остаётся с плейсхолдером origin (её читают seo:check и следующие прогоны), а
// у каждого сервера свой SITE_URL. Профиль (SITE_URL, ROBOTS_POLICY, PORT, канал формы) — env.
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
if (!existsSync(join(root, 'dist/client'))) {
  console.error('[serve] dist/client не найден — сначала pnpm build')
  process.exit(1)
}

const app = mkdtempSync(join(tmpdir(), 'site-e2e-'))
cpSync(join(root, 'dist'), join(app, 'dist'), { recursive: true })
mkdirSync(join(app, 'docker'))
for (const file of ['entrypoint.sh', 'stamp.mjs', 'server.mjs']) {
  cpSync(join(root, 'docker', file), join(app, 'docker', file))
}
symlinkSync(join(root, 'node_modules'), join(app, 'node_modules'))

const server = spawn(
  'sh',
  [join(app, 'docker/entrypoint.sh'), 'node', join(app, 'docker/server.mjs')],
  { env: { ...process.env, DIST_DIR: join(app, 'dist') }, stdio: 'inherit' },
)
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal))
server.on('exit', (code) => {
  rmSync(app, { recursive: true, force: true })
  process.exit(code ?? 1)
})
