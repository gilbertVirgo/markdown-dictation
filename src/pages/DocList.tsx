import { useEffect, useState } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router'
import { api } from '../lib/api'
import { Plus, Trash } from '../ui/icons'
import { Loader } from '../ui/Loader'

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
  const { pathname } = useLocation()
  const current = useMatch('/doc/:id')?.params.id

  // refetch per route change: on desktop this list stays mounted beside the doc
  useEffect(() => {
    api<{ docs: Item[] }>('/docs').then((r) => (setDocs(r.docs), setFailed(false)), () => setFailed(true))
  }, [pathname])

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
      if (d.id === current) navigate('/')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <nav className="min-h-dvh bg-c100 pt-[env(safe-area-inset-top)] text-ink lg:min-h-full">
      <div className="flex items-center justify-between py-2 pr-2 pl-4">
        <span className="t-small">Dictate</span>
        <button onClick={create} disabled={creating} aria-label="New document" className="flex size-11 items-center justify-center bg-hot text-ink disabled:bg-c300">
          <Plus className="size-6" />
        </button>
      </div>
      {docs === null && !failed && <Loader label="Fetching" />}
      {failed && <p className="t-small p-4 text-mute">Couldn’t load documents.</p>}
      {docs?.length === 0 && <p className="t-small p-4 text-mute">No documents yet. Tap + to start dictating.</p>}
      <ul>
        {docs?.map((d, i) => (
          <li
            key={d.id}
            style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
            className={`rise group flex items-center ${d.id === current ? 'bg-c200' : 'hover:bg-c200/60'}`}
          >
            <button onClick={() => navigate(`/doc/${d.id}`)} aria-current={d.id === current ? 'page' : undefined} className="min-w-0 flex-1 px-4 py-3 text-left">
              {/* leading > t-big's 0.95 so truncate doesn't clip descenders */}
              <div className="t-big truncate text-[36px] leading-[1.1] lg:text-[22px]">{d.title}</div>
              <div className="t-small mt-1 text-mute">{ago(d.updatedAt)}</div>
            </button>
            <button onClick={() => remove(d)} aria-label="Delete" className="min-h-14 w-14 text-mute hover:text-hot-text focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
              <Trash className="mx-auto size-5" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
