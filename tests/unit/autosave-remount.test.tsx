// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createMemoryRouter, useParams } from 'react-router'
import { expect, it, vi } from 'vitest'
import { Shell } from '../../src/App'
import { useAutosave } from '../../src/hooks/useAutosave'

vi.mock('../../src/pages/DocList', () => ({ default: () => null }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Desktop keeps the doc page in place when the sidebar switches docs. If Shell stops remounting it
// per id, one useAutosave spans both docs and a queued save for A can PUT B's text to /docs/A.
it('Shell remounts the doc page per id so a queued save never sends another doc\'s text', async () => {
  vi.useFakeTimers()
  const puts: [string, string][] = []
  let releaseFirst!: () => void
  const ok = { ok: true, status: 200, json: async () => ({}) }
  globalThis.fetch = vi.fn((url: string, init: RequestInit) => {
    puts.push([url, JSON.parse(init.body as string).markdown])
    return puts.length === 1 ? new Promise((r) => (releaseFirst = () => r(ok))) : Promise.resolve(ok)
  }) as unknown as typeof fetch

  let text = 'A1'
  let markDirty!: () => void
  const Page = () => {
    markDirty = useAutosave(useParams().id!, () => text).markDirty
    return null
  }
  const router = createMemoryRouter(
    [{ element: <Shell />, children: [{ path: '/doc/:id', element: <Page /> }] }],
    { initialEntries: ['/doc/A'] },
  )
  const root = createRoot(document.createElement('div'))
  await act(async () => root.render(<RouterProvider router={router} />))

  await act(async () => { markDirty(); vi.advanceTimersByTime(800) }) // save #1 (A1) in flight, slow
  await act(async () => { text = 'A2'; markDirty(); vi.advanceTimersByTime(800) }) // save #2 queued behind it
  await act(async () => { await router.navigate('/doc/B') })
  await act(async () => { text = 'B1'; markDirty() })
  await act(async () => { releaseFirst() })
  await act(async () => { await vi.runAllTimersAsync() })

  expect(puts.length).toBeGreaterThan(2)
  expect(puts.filter(([u, md]) => u.endsWith('/docs/A') && md.startsWith('B'))).toEqual([])
  expect(puts.filter(([u]) => u.endsWith('/docs/B')).map(([, md]) => md)).toEqual(['B1'])
  vi.useRealTimers()
})
