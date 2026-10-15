import type { Engine } from './types'

// lib.dom ships the event types but not the recognizer itself.
type Recognition = EventTarget & {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
declare global {
  interface Window {
    SpeechRecognition?: new () => Recognition
    webkitSpeechRecognition?: new () => Recognition
  }
}

const SR = () => window.SpeechRecognition ?? window.webkitSpeechRecognition

export const isSupported = () => !!SR()

let rec: Recognition | null = null

export const webspeech: Engine = {
  async start(opts) {
    const Ctor = SR()
    if (!Ctor) return opts.onError('Speech recognition is not supported in this browser')
    webspeech.stop()
    const r = new Ctor()
    rec = r
    r.continuous = true
    r.interimResults = true
    r.lang = opts.lang
    let failures = 0 // consecutive errors with no result in between
    const fail = (msg: string) => {
      opts.onError(msg)
      webspeech.stop()
    }
    r.onresult = (e) => {
      if (rec !== r) return
      failures = 0
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          if (text.trim()) opts.onFinal(text.trim())
        } else interim += text
      }
      opts.onInterim(interim)
    }
    r.onerror = (e) => {
      if (rec !== r) return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') return fail('Microphone access was denied')
      if (e.error === 'audio-capture') return fail('No microphone found')
      // no-speech is just silence and must not count, or a quiet user gets cut off; others (network...) restart via onend
      if (e.error !== 'no-speech' && ++failures >= 5) fail('speech recognition keeps failing')
    }
    // Chrome ends sessions on silence/timeouts; keep restarting until stop(). Identity check ignores stale recognizers.
    r.onend = () => {
      if (rec !== r) return
      setTimeout(() => {
        if (rec !== r) return
        try {
          r.start()
        } catch (err) {
          // "already started" InvalidStateError is harmless; anything else is fatal
          if ((err as Error).name !== 'InvalidStateError') fail((err as Error).message)
        }
      }, 250)
    }
    r.start()
  },
  stop() {
    const r = rec
    rec = null
    r?.abort()
  },
}
