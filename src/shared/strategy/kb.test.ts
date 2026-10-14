import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { KB_SHA256 } from '../../../scripts/lib/site-policy.mjs'

const ROOT = join(import.meta.dirname, '../../../strategy')

describe('strategy/kb', () => {
  // Каталоги базы в снимке — копии файлов базы strategy: правка руками разошлась бы с нормой молча. Новая версия
  // базы — замена файла и его sha256 в политике сборки одним диффом; файл без строки политики — тоже расхождение.
  it('копии каталогов базы — версии, закреплённые в политике сборки', () => {
    const copies = Object.fromEntries(
      readdirSync(join(ROOT, 'kb'), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const path = join(entry.parentPath, entry.name)
          return [
            relative(ROOT, path),
            createHash('sha256').update(readFileSync(path)).digest('hex'),
          ]
        }),
    )
    expect(copies).toEqual(KB_SHA256)
  })
})
