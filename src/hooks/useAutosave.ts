import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

export function useAutosave(
  id: string,
  getMarkdown: () => string,
): { status: 'saved' | 'saving' | 'error'; markDirty(): void; cancel(): Promise<void>; flush(): Promise<void> } {
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const maxWait = useRef<ReturnType<typeof setTimeout>>(undefined) // caps debounce during continuous edits
  const queue = useRef<Promise<void>>(Promise.resolve())
  const get = useRef(getMarkdown)
  get.current = getMarkdown

  const fail = useCallback(() => {
    dirty.current = true
    setStatus('error')
  }, [])

  // Runs serialized on `queue`; reads markdown at run time so a queued save always sends the latest body.
  const doSave = useCallback(async () => {
    clearTimeout(maxWait.current)
    maxWait.current = undefined
    if (!dirty.current) return
    dirty.current = false
    try {
      await api('/docs/' + id, { method: 'PUT', body: JSON.stringify({ markdown: get.current() }) })
      if (!dirty.current) setStatus('saved')
    } catch {
      fail()
    }
  }, [id, fail])

  const markDirty = useCallback(() => {
    dirty.current = true
    setStatus('saving')
    const save = () => {
      clearTimeout(timer.current)
      queue.current = queue.current.then(doSave)
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(save, 800)
    maxWait.current ??= setTimeout(save, 5000)
  }, [doSave])

  // Drop pending changes and wait for any in-flight save (e.g. before DELETE).
  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    clearTimeout(maxWait.current)
    maxWait.current = undefined
    dirty.current = false
    return queue.current
  }, [])

  // ponytail: keepalive bodies are capped at ~64KB per page; larger docs fail here and stay 'error'
  // (normal debounced save still covers them). Upgrade: chunk or use navigator.sendBeacon + POST endpoint.
  const flushNow = useCallback(() => {
    if (!dirty.current) return Promise.resolve()
    clearTimeout(timer.current)
    clearTimeout(maxWait.current)
    maxWait.current = undefined
    dirty.current = false
    return fetch('/api/docs/' + id, {
      method: 'PUT',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ markdown: get.current() }),
    }).then((r) => (r.ok ? setStatus('saved') : fail()), fail)
  }, [id, fail])

  // Awaitable flush (logout): let in-flight saves land first so ours is last.
  const flush = useCallback(() => queue.current.then(flushNow), [flushNow])

  useEffect(() => {
    const onVis = () => document.visibilityState === 'hidden' && flushNow()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flushNow)
    return () => {
      flushNow() // SPA navigation away (e.g. back button)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flushNow)
    }
  }, [flushNow])

  return { status, markDirty, cancel, flush }
}
