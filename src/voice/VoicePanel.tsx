import { useRef, useState } from 'react'
import type { BlockType } from '../editor/Editor'
import { useTranscriber, type EngineName } from './useTranscriber'
import { isSupported } from './engines/webspeech'

export type Settings = { engine: EngineName; refine: boolean; lang: string }
const KEY = 'dictate.settings'
const ENGINE_NAMES: EngineName[] = ['webspeech', 'openai', 'deepgram']
const DEFAULTS: Settings = { engine: 'webspeech', refine: true, lang: 'en-GB' }

export function loadSettings(): Settings {
  try {
    const s: Settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    if (!ENGINE_NAMES.includes(s.engine)) s.engine = DEFAULTS.engine
    return s
  } catch {
    return DEFAULTS
  }
}

const BLOCKS: [BlockType, string][] = [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['body', 'Body'], ['quote', 'Quote']]

export function VoicePanel({ onChunk, vocabulary, settings, setSettings }: {
  onChunk(text: string, block: BlockType): void
  vocabulary: () => string[]
  settings: Settings
  setSettings(s: Settings): void
}) {
  const [pendingBlock, setPendingBlock] = useState<BlockType>('body')
  // ref so back-to-back finals before a re-render don't both land in the selected block
  const blockRef = useRef(pendingBlock)
  const pick = (b: BlockType) => setPendingBlock((blockRef.current = b))
  const dialog = useRef<HTMLDialogElement>(null)
  const langInput = useRef<HTMLInputElement>(null) // applied on close so typing doesn't restart the mic per keystroke

  const t = useTranscriber({
    engine: settings.engine,
    lang: settings.lang,
    vocabulary,
    onFinal(text) {
      onChunk(text, blockRef.current)
      pick('body')
    },
  })

  function update(patch: Partial<Settings>) {
    const s = { ...settings, ...patch }
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {}
    setSettings(s)
  }

  const hot = t.live && !t.muted
  const notice = settings.engine === 'webspeech' && !isSupported()
    ? 'Speech recognition isn’t supported in this browser. Try Chrome or Safari, or pick another engine.'
    : t.error

  return (
    <div className="sticky bottom-0 z-10 flex flex-col items-center gap-3 border-t border-border bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <p className="min-h-6 w-full truncate text-center text-muted italic" aria-live="polite">
        {notice ?? (t.muted ? 'Muted' : t.interim || (t.live ? 'Listening…' : ''))}
      </p>

      <div className="relative flex w-full items-center justify-center">
        <button
          onClick={t.live ? t.toggleMute : t.start} // not live (e.g. permission denied): tap retries
          aria-label={!t.live ? 'Start microphone' : t.muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={!t.muted}
          className={`flex size-[72px] items-center justify-center rounded-full border border-border ${hot ? 'bg-primary text-white' : 'bg-surface text-fg'}`}
        >
          <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
            {t.muted && <path d="M3 3l18 18" />}
          </svg>
        </button>
        <button
          onClick={() => dialog.current?.showModal()}
          aria-label="Voice settings"
          className="absolute right-0 flex min-h-11 min-w-11 items-center justify-center text-2xl text-muted"
        >
          ⚙
        </button>
      </div>

      <div className="grid w-full grid-cols-5 gap-2" role="radiogroup" aria-label="Next block type">
        {BLOCKS.map(([b, label]) => (
          <button
            key={b}
            role="radio"
            aria-checked={pendingBlock === b}
            onClick={() => pick(b)}
            className={`min-h-14 rounded-lg border-2 bg-bg font-semibold ${pendingBlock === b ? 'border-primary text-primary' : 'border-border'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        onClose={() => {
          const lang = langInput.current?.value.trim() || DEFAULTS.lang
          if (lang !== settings.lang) update({ lang })
        }}
        className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-xl border border-border bg-bg p-0 text-fg backdrop:bg-black/50"
      >
        <form method="dialog" className="flex flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold">Voice settings</h2>
          <label className="flex flex-col gap-1">
            Engine
            <select
              value={settings.engine}
              onChange={(e) => update({ engine: e.target.value as EngineName })}
              className="min-h-11 rounded-lg border border-border bg-surface px-3"
            >
              <option value="webspeech">Browser (Web Speech)</option>
              <option value="openai">OpenAI</option>
              <option value="deepgram">Deepgram</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={settings.refine} onChange={(e) => update({ refine: e.target.checked })} className="size-5 accent-primary" />
            Refine with Claude
          </label>
          <label className="flex flex-col gap-1">
            Language
            <input
              ref={langInput}
              defaultValue={settings.lang}
              className="min-h-11 rounded-lg border border-border bg-surface px-3"
            />
          </label>
          <button className="min-h-11 rounded-lg bg-primary font-semibold text-white">Done</button>
        </form>
      </dialog>
    </div>
  )
}
