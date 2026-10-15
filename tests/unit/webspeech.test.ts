import { afterEach, describe, expect, it, vi } from 'vitest'

class FakeSR {
  static all: FakeSR[] = []
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  abort = vi.fn()
  constructor() {
    FakeSR.all.push(this)
  }
}
const result = (text: string, isFinal: boolean) => Object.assign([{ transcript: text }], { isFinal })

vi.stubGlobal('window', { webkitSpeechRecognition: FakeSR })
const { webspeech, isSupported } = await import('../../src/voice/engines/webspeech')

const opts = () => ({ lang: 'en-GB', vocabulary: () => [], onFinal: vi.fn(), onInterim: vi.fn(), onError: vi.fn() })

describe('webspeech engine', () => {
  afterEach(() => (webspeech.stop(), vi.useRealTimers()))

  it('configures and emits final + interim from resultIndex', async () => {
    expect(isSupported()).toBe(true)
    const o = opts()
    await webspeech.start(o)
    const r = FakeSR.all.at(-1)!
    expect([r.continuous, r.interimResults, r.lang]).toEqual([true, true, 'en-GB'])
    r.onresult!({ resultIndex: 1, results: [result('old', true), result(' hello ', true), result('wor', false), result('ld', false)] })
    expect(o.onFinal).toHaveBeenCalledExactlyOnceWith('hello')
    expect(o.onInterim).toHaveBeenLastCalledWith('world')
  })

  it('restarts on end until stopped', async () => {
    vi.useFakeTimers()
    await webspeech.start(opts())
    const r = FakeSR.all.at(-1)!
    r.onend!()
    vi.advanceTimersByTime(250)
    expect(r.start).toHaveBeenCalledTimes(2)
    webspeech.stop()
    r.onend!()
    vi.advanceTimersByTime(250)
    expect(r.start).toHaveBeenCalledTimes(2)
  })

  it('stops on not-allowed', async () => {
    vi.useFakeTimers()
    const o = opts()
    await webspeech.start(o)
    const r = FakeSR.all.at(-1)!
    r.onerror!({ error: 'not-allowed' })
    expect(o.onError).toHaveBeenCalled()
    expect(r.abort).toHaveBeenCalled()
    r.onend!()
    vi.advanceTimersByTime(250)
    expect(r.start).toHaveBeenCalledTimes(1)
  })
  it('ignores a replaced recognizer', async () => {
    vi.useFakeTimers()
    const o = opts()
    await webspeech.start(o)
    const first = FakeSR.all.at(-1)!
    await webspeech.start(o)
    first.onend!()
    first.onerror!({ error: 'not-allowed' })
    vi.advanceTimersByTime(250)
    expect(first.start).toHaveBeenCalledTimes(1)
    expect(o.onError).not.toHaveBeenCalled()
  })

  it('stops after 5 consecutive errors, counter reset by results, silence ignored', async () => {
    const o = opts()
    await webspeech.start(o)
    const r = FakeSR.all.at(-1)!
    for (let i = 0; i < 10; i++) r.onerror!({ error: 'no-speech' })
    for (let i = 0; i < 4; i++) r.onerror!({ error: 'network' })
    r.onresult!({ resultIndex: 0, results: [result('hi', false)] })
    for (let i = 0; i < 4; i++) r.onerror!({ error: 'network' })
    expect(o.onError).not.toHaveBeenCalled()
    r.onerror!({ error: 'network' })
    expect(o.onError).toHaveBeenCalledWith('speech recognition keeps failing')
    expect(r.abort).toHaveBeenCalled()
  })

  it('audio-capture stops; a non-InvalidState restart error stops', async () => {
    vi.useFakeTimers()
    const o = opts()
    await webspeech.start(o)
    FakeSR.all.at(-1)!.onerror!({ error: 'audio-capture' })
    expect(o.onError).toHaveBeenCalledTimes(1)
    await webspeech.start(o)
    const r = FakeSR.all.at(-1)!
    r.start.mockImplementation(() => {
      throw Object.assign(new Error('boom'), { name: 'NotAllowedError' })
    })
    r.onend!()
    vi.advanceTimersByTime(250)
    expect(o.onError).toHaveBeenLastCalledWith('boom')
    expect(r.abort).toHaveBeenCalled()
  })
})
