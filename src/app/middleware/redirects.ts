import { buildRedirectTable, resolveRedirect } from '@/shared/redirects'
import redirects from '../../../content/redirects.yaml'

// Таблица строится один раз при загрузке модуля: YAML разобран на сборке (плагин yaml-modules в
// astro.config.ts), в бандле лежат данные, файл в контейнере не нужен. Невалидные данные роняют
// старт процесса — раньше их ловит `pnpm check:content`.
const table = buildRedirectTable(redirects)

// Модуль — отдельный файл серверной сборки (dist/server/redirects.mjs): адресу отвечают и обёртка
// процесса (docker/server.mjs — до статик-хендлера, иначе неканоническую форму и правило на пути
// живой страницы он отдал бы файлом), и middleware — одной и той же таблицей. Адрес читает только
// чтение страницы: POST формы и прочие методы идут в приложение как есть.
export const resolveRequest = (method: string | undefined, url: string) =>
  method === 'GET' || method === 'HEAD' ? resolveRedirect(table, url) : undefined
