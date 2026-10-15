import { useCallback, useEffect, useRef, useState } from 'react'
import { applySpokenCommands } from '../lib/spokenCommands'
import { useNavigate, useParams } from 'react-router'
import { api } from '../lib/api'
import { deriveTitle, extractVocabulary } from '../lib/markdown'
import { Editor, type BlockType, type EditorHandle } from '../editor/Editor'
import { useAutosave } from '../hooks/useAutosave'
import { VoicePanel } from '../voice/VoicePanel'
import { useSettings } from '../lib/settings'
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight'
import { SettingsDialog } from '../ui/SettingsDialog'
import { ArrowLeft, MoreVertical, Settings as SettingsIcon } from '../ui/icons'

type Doc = { id: string; title: string; markdown: string; updatedAt: string }

const STATUS = { saved: 'Saved', saving: 'Saving…', error: 'Offline — unsaved' }

export default function DocPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [failed, setFailed] = useState(false)
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  const editor = useRef<EditorHandle>(null)
  // Latest markdown kept in a ref so unmount flush works after the editor ref is detached.
  const latest = useRef('')
  const { status, markDirty, cancel, flush } = useAutosave(id, () => latest.current)
  const [settings, updateSettings] = useSettings()
  const settingsDialog = useRef<HTMLDialogElement>(null)
  const menu = useRef<HTMLDetailsElement>(null)
  useVisualViewportHeight()
  const refine = useRef(settings.refine)
  refine.current = settings.refine
  const modeRef = useRef(mode)
  modeRef.current = mode

  // <details> doesn't close itself on outside click / Escape
  useEffect(() => {
    const close = (e: Event) => {
      const m = menu.current
      if (!m?.open) return
      if (!(e instanceof KeyboardEvent)) {
        if (!m.contains(e.target as Node)) m.open = false
      } else if (e.key === 'Escape') {
        m.open = false
        m.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])

  useEffect(() => {
    setDoc(null)
    setFailed(false)
    api<Doc>('/docs/' + id).then(
      (d) => {
        latest.current = d.markdown
        setDoc(d)
      },
      () => setFailed(true),
    )
  }, [id])

  const onChange = useCallback(
    (md: string) => {
      latest.current = md
      markDirty()
    },
    [markDirty],
  )

  // Final speech chunk: insert as pending (grey), then swap in Claude's refinement. Edits fire onChange -> markDirty.
  const onChunk = useCallback((text: string, block: BlockType) => {
    const ed = editor.current
    if (!ed) return
    const documentMarkdown = ed.getMarkdown() // before insert, so the raw chunk isn't its own context
    const id = crypto.randomUUID()
    const processed = applySpokenCommands(text)
    if (!ed.insertChunk(processed, block, id)) return
    // editor isn't focusable in voice mode, so bring the new text into view ourselves
    if (modeRef.current === 'voice') requestAnimationFrame(() => editor.current?.scrollToEnd())
    if (!refine.current) return ed.replacePending(id, processed)
    api<{ text: string }>('/refine', { method: 'POST', body: JSON.stringify({ documentMarkdown, chunk: text, block }) }).then(
      (r) => editor.current?.replacePending(id, r.text),
      () => editor.current?.clearPending(id),
    )
  }, [])

  const vocabulary = useCallback(() => extractVocabulary(latest.current), [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __dictate?: unknown }
    w.__dictate = { insertChunk: onChunk }
    return () => void delete w.__dictate
  }, [onChunk])

  const title = () => deriveTitle(latest.current)

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([latest.current], { type: 'text/markdown' }))
    a.download = `${title()}.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 0)
  }

  async function remove() {
    if (!confirm(`Delete "${title()}"?`)) return
    await cancel()
    try {
      await api('/docs/' + id, { method: 'DELETE' })
      navigate('/')
    } catch (e) {
      markDirty() // re-arm the changes cancel() dropped
      alert((e as Error).message)
    }
  }

  async function logout() {
    await flush()
    await api('/logout', { method: 'POST' }).catch(() => {})
    location.replace('/login')
  }

  const item = 'block w-full min-h-11 px-4 text-left'

  return (
    // fixed-height column sized to the visible viewport: header and footer stay put, only the editor scrolls
    <main data-size={settings.size} className="fixed inset-x-0 top-[var(--vvt,0px)] mx-auto flex h-[var(--vvh,100dvh)] w-full max-w-[720px] flex-col overflow-hidden bg-bg text-fg">
      <header className="shrink-0 border-b border-border bg-bg pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1 px-1">
          <button onClick={() => navigate('/')} aria-label="Back" className="flex min-h-11 min-w-11 items-center justify-center">
            <ArrowLeft />
          </button>
          <span className={`rounded-full bg-surface px-3 py-1 text-sm ${status === 'error' ? 'text-primary' : 'text-muted'}`}>
            {STATUS[status]}
          </span>
          <button onClick={() => settingsDialog.current?.showModal()} aria-label="Settings" className="ml-auto flex min-h-11 min-w-11 items-center justify-center">
            <SettingsIcon />
          </button>
          <details ref={menu} className="relative" onClick={(e) => (e.target as HTMLElement).closest('button') && e.currentTarget.removeAttribute('open')}>
            <summary aria-label="Menu" className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden">
              <MoreVertical />
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-border bg-surface py-1 shadow-lg">
              <button className={item} onClick={() => navigator.clipboard.writeText(latest.current)}>Copy markdown</button>
              <button className={item} onClick={download}>Download .md</button>
              <button className={`${item} text-primary`} onClick={remove}>Delete</button>
              <button className={item} onClick={logout}>Logout</button>
            </div>
          </details>
        </div>

        <div role="tablist" className="mx-2 mb-2 flex rounded-lg bg-surface p-1">
          {(['voice', 'text'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 flex-1 rounded-md capitalize ${mode === m ? 'bg-bg font-semibold shadow' : 'text-muted'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {failed && <p className="flex-1 p-8 text-center text-muted">Couldn’t load this document.</p>}
      {doc && <Editor key={id} ref={editor} initial={doc.markdown} editable={mode === 'text'} onChange={onChange} />}

      {mode === 'voice' && doc && <VoicePanel onChunk={onChunk} vocabulary={vocabulary} settings={settings} />}

      <SettingsDialog ref={settingsDialog} settings={settings} update={updateSettings} />
    </main>
  )
}
