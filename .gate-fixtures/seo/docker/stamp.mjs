// Законная обёртка: модуль сборки — путём к файлу через pathToFileURL, а не пакетом.
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = process.env.DIST_DIR || '/app/dist'
export const { loadServerConfig } = await import(
  pathToFileURL(join(dist, 'server/runtime-config.mjs')).href
)
