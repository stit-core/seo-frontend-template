// Законный модуль: зависимости — с подпутём, побочным и динамическим импортом; встроенные модули,
// относительные и вычисляемые импорты — не пакеты; слово sharp и «import 'js-yaml'» в тексте — не импорт.
import { readFileSync } from 'fs'
import { createRequire } from 'node:module'
import '@astrojs/rss'
import * as z from 'zod/v4'
export { loadSharp } from './chunks/sharp_Fx1.mjs'

const __require = createRequire(import.meta.url)
const { relative } = __require('path')

export const imageService = { entrypoint: 'astro/assets/services/sharp' }
export const hint = "import 'js-yaml' — текст ошибки, а не импорт"
export const page = (name) => import(`./chunks/${name}.mjs`)
export const sentry = () => import('@sentry/node')
export { readFileSync, relative, z }
