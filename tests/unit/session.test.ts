import { describe, expect, it } from 'vitest'
import { sign, verify } from '../../netlify/functions/_lib/session'

const S = 'secret'
describe('session', () => {
  it('sign->verify true', () => expect(verify(sign(Date.now() + 1000, S), S)).toBe(true))
  it('tampered false', () => {
    const t = sign(Date.now() + 1000, S)
    expect(verify(t.slice(0, -1) + (t.endsWith('0') ? '1' : '0'), S)).toBe(false)
    expect(verify(sign(Date.now() + 1000, 'other'), S)).toBe(false)
  })
  it('expired false', () => expect(verify(sign(Date.now() - 1, S), S)).toBe(false))
  it('undefined false', () => expect(verify(undefined, S)).toBe(false))
})
