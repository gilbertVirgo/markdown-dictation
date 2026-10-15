import { expect, it } from 'vitest'
import { langCode } from '../../src/voice/engines/langCode'

it('strips region', () => {
  expect(langCode('en-GB')).toBe('en')
  expect(langCode('')).toBe('')
})
