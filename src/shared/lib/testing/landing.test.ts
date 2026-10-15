import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('фикстура базы package-landing', () => {
  it('файлы — копии фикстуры базы байт в байт', () => {
    const sha = (path: string) =>
      createHash('sha256')
        .update(readFileSync(join(import.meta.dirname, 'package-landing/site/promo', path)))
        .digest('hex')
    expect(sha('plans/spasibo.yaml')).toBe(
      'bf659955e251eabc0994d2e98b2e2af70cebdd993203a14cda2d30b20128614c',
    )
    expect(sha('copy/spasibo.yaml')).toBe(
      '2581080140d75c4969637d8e93f5b0219bc1a3726a56d9b8c26e800aeec891e8',
    )
  })
})
