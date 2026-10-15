import type { Engine } from './types'

const SEG_MS = 8000
const MIN_BYTES = 2048
const MAX_WORDS = 200

let session: object | null = null
let stream: MediaStream | null = null
let rec: MediaRecorder | null = null

export const openai: Engine = {
  async start(opts) {
    openai.stop()
    const me = {}
    session = me
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t))
    if (!mimeType) {
      session = null
      return opts.onError('Audio recording is not supported in this browser')
    }
    const ext = mimeType.startsWith('audio/mp4') ? 'm4a' : 'webm'
    let s: MediaStream
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      if (session === me) session = null
      return opts.onError('Microphone access was denied')
    }
    if (session !== me) return s.getTracks().forEach((t) => t.stop()) // stopped while awaiting permission
    stream = s

    let dead = false // set on 401 so the stop() flush doesn't upload again
    const upload = async (blob: Blob) => {
      if (dead || blob.size < MIN_BYTES) return
      const body = new FormData()
      body.append('file', blob, `chunk.${ext}`)
      body.append('prompt', opts.vocabulary().join(', ').split(/\s+/).slice(0, MAX_WORDS).join(' '))
      body.append('lang', opts.lang)
      try {
        const res = await fetch('/api/transcribe-openai', { method: 'POST', body })
        if (res.status === 401) {
          dead = true
          opts.onError('session expired')
          return openai.stop()
        }
        if (!res.ok) return session === me && opts.onError('transcription failed', false)
        // Deliver even after stop(): the final flushed segment must not be lost.
        const { text } = (await res.json()) as { text?: string }
        if (text?.trim()) opts.onFinal(text.trim())
      } catch {
        if (session === me) opts.onError('transcription failed', false)
      }
    }

    // ponytail: fixed 8s segments can split words; upgrade: silence-based segmentation
    const loop = () => {
      if (session !== me) return
      const r = new MediaRecorder(s, { mimeType })
      rec = r
      r.ondataavailable = (e) => void upload(e.data)
      r.onstop = loop // restart immediately; no-op after stop() since session changed
      r.start()
      setTimeout(() => r.state === 'recording' && r.stop(), SEG_MS)
    }
    loop()
  },
  stop() {
    const r = rec
    const s = stream
    session = null
    rec = null
    stream = null
    if (r?.state === 'recording') r.stop()
    s?.getTracks().forEach((t) => t.stop())
  },
}
