import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

export function useAutosave(id: string, getMarkdown: () => string): { status: 'saved' | 'saving' | 'error'; markDirty(): void } {
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const get = useRef(getMarkdown)
  get.current = getMarkdown

  const save = useCallback(async () => {
    clearTimeout(timer.current)
    dirty.current = false
    try {
      await api('/docs/' + id, { method: 'PUT', body: JSON.stringify({ markdown: get.current() }) })
      if (!dirty.current) setStatus('saved')
    } catch {
      dirty.current = true
      setStatus('error')
    }
  }, [id])

  const markDirty = useCallback(() => {
    dirty.current = true
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(save, 800)
  }, [save])

  useEffect(() => {
    const fail = () => {
      dirty.current = true
      setStatus('error')
    }
    const flush = () => {
      if (!dirty.current) return
      clearTimeout(timer.current)
      dirty.current = false
      fetch('/api/docs/' + id, {
        method: 'PUT',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markdown: get.current() }),
      }).then(
        (r) => (r.ok ? setStatus('saved') : fail()),
        fail,
      )
    }
    const onVis = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      flush() // SPA navigation away (e.g. back button)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
    }
  }, [id])

  return { status, markDirty }
}
