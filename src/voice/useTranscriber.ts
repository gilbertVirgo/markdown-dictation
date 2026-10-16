import { useCallback, useEffect, useRef, useState } from 'react'
import type { Engine } from './engines/types'
import { webspeech } from './engines/webspeech'
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

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(raf.current)
    void audio.current?.close().catch(() => {})
    audio.current = null
    latest.current.onLevel?.(0)
  }, [])

  const stop = useCallback(() => {
    call.current++
    ENGINES[engine].stop()
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
    ENGINES[engine]
      .start({
        lang,
        vocabulary: () => latest.current.vocabulary(),
        onStream(stream) {
          if (call.current !== me || !ctx) return
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
          latest.current.onFinal(text)
        },
        onInterim(text) {
          setInterim(text)
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
  }, [engine, lang, stopMeter])

  // stop on unmount, and stop the old engine when the engine changes (stop is recreated)
  useEffect(() => () => stop(), [stop])

  return { live, connecting, interim, error, start, stop }
}
