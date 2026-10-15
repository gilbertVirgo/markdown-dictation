import { api } from '../../lib/api'
import type { Engine } from './types'

const MAX_KEYTERMS = 50
const MAX_FAILURES = 5

export function buildListenUrl(lang: string, keyterms: string[]): string {
  const p = new URLSearchParams({ model: 'nova-3', smart_format: 'true', interim_results: 'true', language: lang })
  for (const k of keyterms.slice(0, MAX_KEYTERMS)) p.append('keyterm', k)
  return `wss://api.deepgram.com/v1/listen?${p}`
}

let session: object | null = null
let stream: MediaStream | null = null
let rec: MediaRecorder | null = null
let ws: WebSocket | null = null

export const deepgram: Engine = {
  async start(opts) {
    deepgram.stop()
    const me = {}
    session = me
    // ponytail: Deepgram docs list mp4 as supported but don't promise fragmented-mp4 streaming (iOS Safari);
    // if iOS yields no transcripts, switch to AudioWorklet + encoding=linear16.
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
    if (!mimeType) {
      session = null
      return opts.onError('Audio recording is not supported in this browser')
    }
    let s: MediaStream
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      if (session === me) session = null
      return opts.onError('Microphone access was denied')
    }
    if (session !== me) return s.getTracks().forEach((t) => t.stop()) // stopped while awaiting permission
    stream = s

    let failures = 0
    const retry = () => {
      if (session !== me) return
      if (++failures >= MAX_FAILURES) {
        opts.onError('Could not connect to Deepgram')
        return deepgram.stop()
      }
      setTimeout(connect, 500)
    }

    const connect = async () => {
      if (session !== me) return
      let token: string
      try {
        ;({ token } = await api<{ token: string }>('/deepgram-token'))
      } catch {
        return retry()
      }
      if (session !== me) return
      // Each connection gets its own recorder: the container header is only in the first chunk.
      const sock = new WebSocket(buildListenUrl(opts.lang, opts.vocabulary()), ['bearer', token])
      ws = sock
      let keepAlive: ReturnType<typeof setInterval> | undefined
      let r: MediaRecorder | undefined
      sock.onopen = () => {
        if (session !== me) return
        r = new MediaRecorder(s, { mimeType })
        rec = r
        r.ondataavailable = (e) => sock.readyState === WebSocket.OPEN && e.data.size && sock.send(e.data)
        r.start(250)
        keepAlive = setInterval(() => sock.readyState === WebSocket.OPEN && sock.send(JSON.stringify({ type: 'KeepAlive' })), 5000)
      }
      sock.onmessage = (e) => {
        const data = JSON.parse(e.data as string)
        if (data.type !== 'Results') return
        failures = 0 // only a working stream resets the counter
        const text: string = data.channel?.alternatives?.[0]?.transcript?.trim() ?? ''
        if (!text) return
        // Finals still arrive after stop() (CloseStream flush) and must be delivered.
        if (data.is_final) opts.onFinal(text)
        else if (session === me) opts.onInterim(text)
      }
      sock.onclose = () => {
        clearInterval(keepAlive)
        if (r?.state === 'recording') r.stop()
        if (ws === sock) ws = null
        if (rec === r) rec = null
        retry() // no-op if stop() initiated this
      }
    }
    void connect()
  },
  stop() {
    const r = rec
    const sock = ws
    const s = stream
    session = null
    rec = null
    ws = null
    stream = null
    const close = () => {
      if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ type: 'CloseStream' })) // server flushes finals, then closes
      else sock?.close()
    }
    if (r?.state === 'recording') {
      r.onstop = close // last chunk is sent (dataavailable fires before stop) before CloseStream
      r.stop()
    } else close()
    s?.getTracks().forEach((t) => t.stop())
  },
}
