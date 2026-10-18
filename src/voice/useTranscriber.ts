import { useCallback, useEffect, useRef, useState } from 'react'
import type { Engine } from './engines/types'
import { isSupported, isWebKit, webspeech } from './engines/webspeech'
import { openai } from './engines/openai'
import { deepgram } from './engines/deepgram'

export type EngineName = 'webspeech' | 'openai' | 'deepgram'
const ENGINES: Record<EngineName, Engine> = { webspeech, openai, deepgram }

export function useTranscriber(opts: {
  engine: EngineName
  lang: string
  vocabulary: () => string[]
  onFinal(text: string): void
  onLevel?(level: number): void // 0..1 mic input level, per animation frame
  onPhantom?(text: string): void // words heard but not yet final, for instant feedback in the editor
}): {
  live: boolean
  connecting: boolean
  interim: string
  error: string | null
  start(): void
  stop(): void
} {
  const { engine, lang } = opts
  const [live, setLive] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const call = useRef(0) // bumped per start()/stop() so a superseded start's callbacks are ignored
  const latest = useRef(opts)
  latest.current = opts
  const audio = useRef<AudioContext | null>(null)
  const raf = useRef(0)
  // Phantoms: the slower engines (Deepgram, OpenAI) are shadowed by the free browser recognizer, which shows words first.
  // heard = its words so far, consumed = how many of them the main engine has since finalised.
  // Whenever it has nothing (no recognizer, WebKit, or it failed), the main engine's own interim is shown instead.
  const shadow = useRef({ heard: [] as string[], interim: [] as string[], consumed: 0 })
  const engineInterim = useRef('')
  const showPhantom = useCallback(() => {
    const s = shadow.current
    latest.current.onPhantom?.([...s.heard, ...s.interim].slice(s.consumed).join(' ') || engineInterim.current)
  }, [])
  const words = (t: string) => t.split(/\s+/).filter(Boolean)

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(raf.current)
    void audio.current?.close().catch(() => {})
    audio.current = null
    latest.current.onLevel?.(0)
  }, [])

  const stop = useCallback(() => {
    call.current++
    ENGINES[engine].stop()
    if (engine !== 'webspeech') webspeech.stop()
    shadow.current = { heard: [], interim: [], consumed: 0 }
    engineInterim.current = ''
    engineInterim.current = ''
    latest.current.onPhantom?.('')
    stopMeter()
    setLive(false)
    setConnecting(false)
    setInterim('')
  }, [engine, stopMeter])

  const start = useCallback(() => {
    const me = ++call.current
    let failed = false
    setError(null)
    setConnecting(true)
    stopMeter()
    // created synchronously inside the tap so iOS Safari lets it run
    const ctx = typeof AudioContext === 'undefined' ? null : new AudioContext()
    audio.current = ctx
    const shadowed = engine !== 'webspeech' && isSupported() && !isWebKit()
    shadow.current = { heard: [], interim: [], consumed: 0 }
    ENGINES[engine]
      .start({
        lang,
        vocabulary: () => latest.current.vocabulary(),
        onStream(stream) {
          if (call.current !== me) return
          // after the main engine has the mic, so the two permission prompts don't race; best effort, errors ignored
          if (shadowed)
            void webspeech.start({
              lang,
              vocabulary: () => [],
              onFinal(text) {
                if (call.current !== me) return
                shadow.current.heard.push(...words(text))
                shadow.current.interim = []
                showPhantom()
              },
              onInterim(text) {
                if (call.current !== me) return
                shadow.current.interim = words(text)
                showPhantom()
              },
              onError() {
                // the browser recognizer gave up: fall back to the main engine's interim
                if (call.current !== me) return
                shadow.current = { heard: [], interim: [], consumed: 0 }
                showPhantom()
              },
            })
          if (!ctx) return
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          analyser.smoothingTimeConstant = 0.6
          ctx.createMediaStreamSource(stream).connect(analyser)
          const buf = new Uint8Array(analyser.fftSize)
          const tick = () => {
            analyser.getByteTimeDomainData(buf)
            let sum = 0
            for (const v of buf) sum += ((v - 128) / 128) ** 2
            latest.current.onLevel?.(Math.min(1, Math.sqrt(sum / buf.length) * 4))
            raf.current = requestAnimationFrame(tick)
          }
          tick()
        },
        onFinal(text) {
          setInterim('')
          if (!failed && call.current === me) setError(null) // transient error recovered
          engineInterim.current = '' // the final replaces it
          if (shadowed) {
            // drop as many phantom words as the final has; between the browser's phrases, rebase so word-count drift can't build up
            const s = shadow.current
            s.consumed += words(text).length
            if (!s.interim.length) shadow.current = { heard: s.heard.slice(s.consumed), interim: [], consumed: 0 }
          }
          showPhantom()
          latest.current.onFinal(text)
        },
        onInterim(text) {
          setInterim(text)
          engineInterim.current = text
          showPhantom()
        },
        onError(msg, fatal = true) {
          if (call.current !== me) return
          setError(msg)
          if (!fatal) return // transient (e.g. one failed upload): keep listening
          failed = true
          ENGINES[engine].stop()
          stopMeter()
          setLive(false)
          setConnecting(false)
        },
      })
      .then(
        () => call.current === me && (setConnecting(false), setLive(!failed)),
        (e: Error) => call.current === me && (setConnecting(false), setError(e.message), stopMeter(), setLive(false)),
      )
  }, [engine, lang, stopMeter, showPhantom])

  // stop on unmount, and stop the old engine when the engine changes (stop is recreated)
  useEffect(() => () => stop(), [stop])

  return { live, connecting, interim, error, start, stop }
}
