// Обёртка процесса — тоже рантайм образа: её пакеты ставит та же стадия prod-deps. Зависимость, которую
// грузит только она, законна, имя шаблоном без подстановок — строка. require — и вызов результата
// createRequire, и любое имя, которому модуль его присвоил; имя модуля шаблоном с подстановкой не прочесть.
import { createRequire } from 'node:module'
import { loadServerConfig } from '../dist/server/runtime-config.mjs'

const { default: pino } = await import(`pino`)
const semver = createRequire(import.meta.url)('semver')
const readYaml = () => load('yaml')
const load = createRequire(import.meta.url)
let requireDev
requireDev = createRequire(import.meta.url)
const colors = requireDev('picocolors')
const plugin = await import(`${process.env.PLUGIN_DIR}/plugin.mjs`)
export const logger = pino(loadServerConfig(), { semver, readYaml, colors, plugin })
