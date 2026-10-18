// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { EngineOpts } from '../../src/voice/engines/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const started: Record<string, EngineOpts> = {}
let webkit = false
const fake = (name: string) => ({ start: async (o: EngineOpts) => void (started[name] = o), stop: () => {} })
vi.mock('../../src/voice/engines/webspeech', () => ({ webspeech: fake('webspeech'), isSupported: () => true, isWebKit: () => webkit }))
vi.mock('../../src/voice/engines/deepgram', () => ({ deepgram: fake('deepgram') }))
vi.mock('../../src/voice/engines/openai', () => ({ openai: fake('openai') }))
const { useTranscriber } = await import('../../src/voice/useTranscriber')

async function mount(phantom: (t: string) => void) {
  let t!: ReturnType<typeof useTranscriber>
  function Probe() {
    t = useTranscriber({ engine: 'deepgram', lang: 'en-GB', vocabulary: () => [], onFinal() {}, onPhantom: phantom })
    return null
  }
  await act(async () => createRoot(document.createElement('div')).render(createElement(Probe)))
  await act(async () => t.start())
  return t
}

it('browser recognizer shows phantoms until Deepgram finalises those words', async () => {
  const phantom = vi.fn()
  const t = await mount(phantom)
  act(() => started.deepgram.onStream!({} as MediaStream))
  const shadow = started.webspeech
  const last = () => phantom.mock.lastCall![0]
  act(() => shadow.onInterim('hello there'))
  expect(last()).toBe('hello there')
  act(() => (shadow.onFinal('hello there world'), shadow.onInterim('again')))
  expect(last()).toBe('hello there world again')
  act(() => started.deepgram.onFinal('Hello there'))
  expect(last()).toBe('world again')
  act(() => (shadow.onInterim(''), started.deepgram.onFinal('world')))
  expect(last()).toBe('') // rebased between phrases
  act(() => shadow.onInterim('next'))
  expect(last()).toBe('next')
  act(() => t.stop())
  expect(last()).toBe('')
})

it('WebKit skips the browser recognizer and shows Deepgram interims instead', async () => {
  webkit = true
  delete started.webspeech
  const phantom = vi.fn()
  await mount(phantom)
  act(() => started.deepgram.onStream!({} as MediaStream))
  expect(started.webspeech).toBeUndefined()
  act(() => started.deepgram.onInterim('hello there'))
  expect(phantom).toHaveBeenLastCalledWith('hello there')
  act(() => started.deepgram.onFinal('Hello there.')) // the final text replaces the grey copy
  expect(phantom).toHaveBeenLastCalledWith('')
})
