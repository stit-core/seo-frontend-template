// Законная обёртка: модули сборки — путём к файлу, pathToFileURL под своим именем и через объект.
import { join } from 'node:path'
import * as url from 'node:url'
import { pathToFileURL } from 'node:url'

const dist = process.env.DIST_DIR || '/app/dist'
export const { loadServerConfig } = await import(
  pathToFileURL(join(dist, 'server/runtime-config.mjs')).href
)
export const { resolveRequest } = await import(url.pathToFileURL(join(dist, 'server/redirects.mjs')).href)
