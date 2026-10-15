import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import { Plus, Trash } from '../ui/icons'

type Item = { id: string; title: string; updatedAt: string }

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, n] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const)
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit)
  return rtf.format(0, 'second')
}

export default function DocList() {
  const [docs, setDocs] = useState<Item[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [failed, setFailed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api<{ docs: Item[] }>('/docs').then((r) => setDocs(r.docs), () => setFailed(true))
  }, [])

  async function create() {
    setCreating(true)
    try {
      const { id } = await api<{ id: string }>('/docs', { method: 'POST' })
      navigate(`/doc/${id}`)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function remove(d: Item) {
    if (!confirm(`Delete "${d.title}"?`)) return
    try {
      await api('/docs/' + d.id, { method: 'DELETE' })
      setDocs((x) => x?.filter((i) => i.id !== d.id) ?? null)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[720px] bg-bg text-fg pb-28">
      {failed && <p className="p-8 text-center text-muted">Couldn’t load documents.</p>}
      {docs?.length === 0 && <p className="p-8 text-center text-muted">No documents yet. Tap + to start dictating.</p>}
      <ul>
        {docs?.map((d) => (
          <li key={d.id} className="flex items-center min-h-14 border-b border-border">
            <button onClick={() => navigate(`/doc/${d.id}`)} className="flex-1 min-h-14 px-4 text-left min-w-0">
              <div className="truncate">{d.title}</div>
              <div className="text-sm text-muted">{ago(d.updatedAt)}</div>
            </button>
            <button onClick={() => remove(d)} aria-label="Delete" className="min-h-14 w-14 text-muted">
              <Trash className="mx-auto size-5" />
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={create}
        disabled={creating}
        aria-label="New document"
        className="fixed right-4 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg disabled:opacity-50"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <Plus className="size-7" />
      </button>
    </main>
  )
}
