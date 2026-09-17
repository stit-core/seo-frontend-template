import { describe, expect, it } from 'vitest'
import { getRuntimeConfig } from './index'

describe('runtime config', () => {
  it('даёт дефолты без env', () => {
    expect(getRuntimeConfig().ROBOTS_POLICY).toBe('index')
  })
})
