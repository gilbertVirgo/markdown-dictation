import { expect, it } from 'vitest'
import { buildListenUrl } from '../../src/voice/engines/deepgram'

it('builds listen url with encoded, capped keyterms', () => {
  const u = new URL(buildListenUrl('en-GB', ['Kubernetes', 'customer service', ...Array.from({ length: 60 }, (_, i) => `t${i}`)]))
  expect(u.origin + u.pathname).toBe('wss://api.deepgram.com/v1/listen')
  expect(u.searchParams.get('model')).toBe('nova-3')
  expect(u.searchParams.get('smart_format')).toBe('true')
  expect(u.searchParams.get('interim_results')).toBe('true')
  expect(u.searchParams.get('language')).toBe('en-GB')
  expect(u.searchParams.getAll('keyterm')).toHaveLength(50)
  expect(u.searchParams.getAll('keyterm')[1]).toBe('customer service')
  expect(u.search).toContain('keyterm=customer+service')
})
