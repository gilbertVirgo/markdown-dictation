import { useCallback, useEffect, useRef, useState } from 'react'
import type { Engine } from './engines/types'
import { webspeech } from './engines/webspeech'
import { openai } from './engines/openai'
import { deepgram } from './engines/deepgram'

export type EngineName = 'webspeech' | 'openai' | 'deepgram'
const ENGINES: Record<EngineName, Engine> = { webspeech, openai, deepgram }

export function useTranscriber(opts: { engine: EngineName; lang: string; vocabulary: () => string[]; onFinal(text: string): void }): {
  live: boolean
  muted: boolean
  interim: string
  error: string | null
  start(): void
  stop(): void
  toggleMute(): void
} {
  const { engine, lang } = opts
  const [live, setLive] = useState(false)
  const [muted, setMuted] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mutedRef = useRef(false)
  const call = useRef(0) // bumped per start()/stop() so a superseded start's callbacks are ignored
  const latest = useRef(opts)
  latest.current = opts

  const stop = useCallback(() => {
    call.current++
    ENGINES[engine].stop()
    setLive(false)
    setInterim('')
  }, [engine])

  const start = useCallback(() => {
    const me = ++call.current
    let failed = false
    setError(null)
    ENGINES[engine]
      .start({
        lang,
        vocabulary: () => latest.current.vocabulary(),
        onFinal(text) {
          setInterim('')
          if (!failed && call.current === me) setError(null) // transient error recovered
          if (!mutedRef.current) latest.current.onFinal(text)
        },
        onInterim(text) {
          setInterim(mutedRef.current ? '' : text)
        },
        onError(msg, fatal = true) {
          if (call.current !== me) return
          setError(msg)
          if (!fatal) return // transient (e.g. one failed upload): keep listening
          failed = true
          ENGINES[engine].stop()
          setLive(false)
        },
      })
      .then(
        () => call.current === me && setLive(!failed),
        (e: Error) => call.current === me && (setError(e.message), setLive(false)),
      )
  }, [engine, lang])

  // Mounted only in voice mode: start on enter / engine or language change, stop on leave.
  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current
    setMuted(mutedRef.current)
    setInterim('')
  }, [])

  return { live, muted, interim, error, start, stop, toggleMute }
}
