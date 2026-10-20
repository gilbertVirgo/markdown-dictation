import { useCallback, useEffect, useRef, useState } from 'react'
import { applySpokenCommands } from '../lib/spokenCommands'
import { useNavigate, useParams } from 'react-router'
import { api } from '../lib/api'
import { deriveTitle, extractVocabulary } from '../lib/markdown'
import type { HeadingSuggestion } from '../lib/headingsPrompt'
import { Editor, type BlockType, type EditorHandle } from '../editor/Editor'
import { useAutosave } from '../hooks/useAutosave'
import { VoicePanel } from '../voice/VoicePanel'
import { useSettings } from '../lib/settings'
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight'
import { SettingsDialog } from '../ui/SettingsDialog'
import { Dots, Loader } from '../ui/Loader'
import { ArrowLeft, BookOpen, MoreVertical, PanelLeft, Settings as SettingsIcon, X } from '../ui/icons'

type Doc = { id: string; title: string; markdown: string; updatedAt: string }

// block breaks aren't characters anyone typed
function count(text: string) {
  const n = (x: number, unit: string) => `${x.toLocaleString()} ${unit}${x === 1 ? '' : 's'}`
  return [n(text.match(/\S+/g)?.length ?? 0, 'word'), n([...text.replace(/\n/g, '')].length, 'character')]
}

const STATUS = { saved: 'Saved', saving: 'Saving…', error: 'Offline — unsaved' }

export default function DocPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [failed, setFailed] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [counts, setCounts] = useState<string[]>([])
  // next dictated chunk's block type, picked in the toolbar while the mic is on; ref so back-to-back finals don't both use it
  const [nextBlock, setNextBlock] = useState<BlockType>('body')
  const nextRef = useRef(nextBlock)
  const pickNext = useCallback((b: BlockType) => setNextBlock((nextRef.current = b)), [])
  const [dictating, setDictating] = useState(false)
  // suggested headings: how many are showing, whether a request is out, and why the last one gave nothing
  const [headings, setHeadings] = useState({ count: 0, busy: false, error: null as string | null })
  const onSuggestions = useCallback((count: number) => setHeadings((h) => (h.count === count ? h : { ...h, count })), [])
  const editor = useRef<EditorHandle>(null)
  // Latest markdown, serialised only when something reads it. Refs, so the unmount flush works after the editor ref is detached.
  const latest = useRef('')
  const reader = useRef<(() => string) | null>(null)
  const markdown = useCallback(() => {
    if (reader.current) (latest.current = reader.current()), (reader.current = null)
    return latest.current
  }, [])
  const { status, markDirty, cancel, flush } = useAutosave(id, markdown)
  const [settings, updateSettings] = useSettings()
  const settingsDialog = useRef<HTMLDialogElement>(null)
  const menu = useRef<HTMLDetailsElement>(null)
  useVisualViewportHeight()
  const refine = useRef(settings.refine)
  refine.current = settings.refine

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
    if (!reading) return
    const exit = (e: KeyboardEvent) => e.key === 'Escape' && setReading(false)
    document.addEventListener('keydown', exit)
    return () => document.removeEventListener('keydown', exit)
  }, [reading])

  useEffect(() => {
    setDoc(null)
    setFailed(false)
    api<Doc>('/docs/' + id).then(
      (d) => {
        latest.current = d.markdown
        reader.current = null
        setDoc(d)
      },
      () => setFailed(true),
    )
  }, [id])

  const onChange = useCallback(
    (read: () => string) => {
      reader.current = read
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
    const placement = ed.insertChunk(processed, block, id)
    if (!placement) return
    // bring the new text into view (the editor may not be focused)
    requestAnimationFrame(() => editor.current?.scrollToEnd())
    // command-only chunk ("new line new line"): nothing for Claude to fix, and it narrates instead of answering
    if (!refine.current || !processed.trim()) return ed.replacePending(id, processed)
    api<{ text: string }>('/refine', { method: 'POST', body: JSON.stringify({ documentMarkdown, chunk: text, block, placement }) }).then(
      (r) => (setRefineError(null), editor.current?.replacePending(id, r.text)),
      // keep the raw text, but say so: otherwise it just looks like missing capitals/punctuation
      (e: Error) => (setRefineError(e.message), editor.current?.clearPending(id)),
    )
  }, [])

  const onPhantom = useCallback((text: string) => editor.current?.setPhantom(text), [])
  function suggestHeadings() {
    const ed = editor.current
    if (!ed) return
    if (dictating) return setHeadings((h) => ({ ...h, error: 'Stop the mic to suggest headings' }))
    const blocks = ed.headingBlocks()
    if (!blocks.some((b) => b.type === 'p')) return setHeadings((h) => ({ ...h, error: 'Write some paragraphs first' }))
    setHeadings((h) => ({ ...h, busy: true, error: null }))
    api<{ headings: HeadingSuggestion[] }>('/suggest-headings', { method: 'POST', body: JSON.stringify({ blocks }) }).then(
      (r) => (editor.current?.suggestHeadings(r.headings), setHeadings((h) => ({ ...h, busy: false, error: r.headings.length ? null : 'No headings to suggest' }))),
      (e: Error) => setHeadings((h) => ({ ...h, busy: false, error: `Couldn’t suggest headings: ${e.message}` })),
    )
  }

  const vocabulary = useCallback(() => extractVocabulary(markdown()), [markdown])
  const onFinal = useCallback((text: string) => (onChunk(text, nextRef.current), pickNext('body')), [onChunk, pickNext])
  const onActive = useCallback((a: boolean) => {
    setDictating(a)
    if (!a) pickNext('body')
  }, [pickNext])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __dictate?: unknown }
    w.__dictate = { insertChunk: onChunk, phantom: onPhantom }
    return () => void delete w.__dictate
  }, [onChunk, onPhantom])

  const title = () => deriveTitle(markdown())

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }))
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

  const item = 't-small block w-full min-h-11 px-4 text-left hover:bg-c200'
  const iconBtn = 'flex min-h-11 min-w-11 items-center justify-center text-mute hover:text-ink'
  const wide = reading || !settings.sidebar // index.css hides the sidebar off data-wide

  return (
    // fixed-height column sized to the visible viewport: header and footer stay put, only the editor scrolls.
    // Desktop: sits right of Shell's fixed 280px sidebar, unless that's hidden.
    // Reading: read-only, no toolbar/mic/chrome, bigger type.
    <main data-size={settings.size} data-reading={reading || undefined} data-wide={wide || undefined} data-pretty={settings.pretty || undefined} className={`fixed inset-x-0 top-[var(--vvt,0px)] flex h-[var(--vvh,100dvh)] flex-col overflow-hidden bg-c50 text-ink ${wide ? '' : 'lg:left-70'}`}>
      {reading ? (
        <header className="shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="flex justify-end px-1 lg:px-4">
            <button onClick={() => setReading(false)} aria-label="Exit reading mode" className={iconBtn}>
              <X />
            </button>
          </div>
        </header>
      ) : (
        <header className="shrink-0 bg-c100 pt-[env(safe-area-inset-top)] lg:bg-c50">
          <div className="flex items-center gap-1 px-1 lg:px-4">
            <button onClick={() => navigate('/')} aria-label="Back" className="flex min-h-11 min-w-11 items-center justify-center lg:hidden">
              <ArrowLeft />
            </button>
            <button onClick={() => updateSettings({ sidebar: !settings.sidebar })} aria-label={settings.sidebar ? 'Hide sidebar' : 'Show sidebar'} className={`${iconBtn} hidden lg:flex`}>
              <PanelLeft />
            </button>
            {/* keyed so each status change rises in like a ticker */}
            <span key={status} className={`t-small rise px-3 lg:ml-auto ${status === 'error' ? 'text-hot-text' : 'text-mute'}`}>
              {status === 'saving' ? <>Saving<Dots /></> : STATUS[status]}
            </span>
            {refineError && (
              <span role="alert" title={refineError} className="t-small min-w-0 line-clamp-2 break-words px-3 text-hot-text">
                Refine failed: {refineError}
              </span>
            )}
            <button onClick={() => setReading(true)} aria-label="Reading mode" className={`${iconBtn} ml-auto lg:ml-0`}>
              <BookOpen />
            </button>
            <button onClick={() => settingsDialog.current?.showModal()} aria-label="Settings" className={iconBtn}>
              <SettingsIcon />
            </button>
            <details ref={menu} className="relative" onToggle={(e) => e.currentTarget.open && setCounts(count(editor.current?.getText() ?? ''))} onClick={(e) => (e.target as HTMLElement).closest('button') && e.currentTarget.removeAttribute('open')}>
              <summary aria-label="Menu" className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center text-mute hover:text-ink [&::-webkit-details-marker]:hidden">
                <MoreVertical />
              </summary>
              <div className="rise absolute top-full right-0 z-20 w-48 bg-c100 py-1" style={{ animationDuration: '.22s' }}>
                <button className={item} onClick={suggestHeadings}>Suggest headings</button>
                <button className={item} onClick={() => navigator.clipboard.writeText(markdown())}>Copy markdown</button>
                <button className={item} onClick={download}>Download .md</button>
                <button className={`${item} text-hot-text`} onClick={remove}>Delete</button>
                <button className={item} onClick={logout}>Logout</button>
                <p className="t-small mt-1 border-t border-c200 px-4 pt-3 pb-2 text-mute">{counts.map((c) => <span key={c} className="block">{c}</span>)}</p>
              </div>
            </details>
          </div>
        </header>
      )}

      {!doc && !failed && <Loader label="Opening" />}
      {failed && <p className="t-small flex-1 p-8 text-center text-mute">Couldn’t load this document.</p>}
      {doc && <Editor key={id} ref={editor} initial={doc.markdown} onChange={onChange} onSuggestions={onSuggestions} editable={!reading} next={dictating ? { block: nextBlock, pick: pickNext } : null} />}

      {doc && !reading && (headings.busy || headings.count > 0 || headings.error) && (
        <div role="status" className="flex shrink-0 items-center gap-1 border-t border-c200 bg-c100 pl-4 lg:pl-8">
          <span className={`t-small min-w-0 flex-1 py-2 ${headings.error && !headings.busy ? 'text-hot-text' : 'text-mute'}`}>
            {headings.busy ? <>Suggesting headings<Dots /></> : headings.error ?? `${headings.count} suggested heading${headings.count === 1 ? '' : 's'}`}
          </span>
          {!headings.busy && headings.count > 0 && (
            <>
              <button className="t-small min-h-11 px-4 text-ink hover:bg-c200" onClick={() => editor.current?.dropHeadings()}>Discard all</button>
              <button className="t-small min-h-11 bg-hot px-4 text-on-hot" onClick={() => (editor.current?.keepHeadings(), setHeadings((h) => ({ ...h, error: null })))}>Keep all</button>
            </>
          )}
          {!headings.busy && !headings.count && (
            <button aria-label="Dismiss" className={iconBtn} onClick={() => setHeadings((h) => ({ ...h, error: null }))}>
              <X />
            </button>
          )}
        </div>
      )}

      {/* hidden, not unmounted: a live mic and in-flight refines keep working */}
      {doc && <div className={reading ? 'hidden' : 'contents'}><VoicePanel onFinal={onFinal} onPhantom={onPhantom} onActive={onActive} next={nextBlock} vocabulary={vocabulary} settings={settings} /></div>}

      <SettingsDialog ref={settingsDialog} settings={settings} update={updateSettings} />
    </main>
  )
}
