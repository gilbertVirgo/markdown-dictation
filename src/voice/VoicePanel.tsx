import { useEffect, useRef } from 'react'
import type { BlockType } from '../editor/Editor'
import { useTranscriber } from './useTranscriber'
import { isSupported } from './engines/webspeech'
import type { Settings } from '../lib/settings'
import { Mic } from '../ui/icons'

const NAMES: Record<BlockType, string> = { h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', body: 'Body', quote: 'Quote' }

// The next block's type is picked in the editor toolbar (DocPage owns it); this panel only reports it.
export function VoicePanel({ onFinal, onPhantom, onActive, next, vocabulary, settings }: {
  onFinal(text: string): void
  onPhantom(text: string): void
  onActive(active: boolean): void
  next: BlockType
  vocabulary: () => string[]
  settings: Settings
}) {
  const ring = useRef<HTMLSpanElement>(null)

  const t = useTranscriber({
    engine: settings.engine,
    lang: settings.lang,
    vocabulary,
    onFinal,
    onPhantom,
    onLevel(level) {
      if (ring.current) ring.current.style.transform = `scale(${1 + level * 0.45})`
    },
  })

  const notice = settings.engine === 'webspeech' && !isSupported()
    ? 'Speech recognition isn’t supported in this browser. Try Chrome or Safari, or pick another engine.'
    : t.error

  const active = t.live || t.connecting
  useEffect(() => onActive(active), [active, onActive])

  const status = notice ? 'Mic error' : t.connecting ? 'Connecting' : t.live ? `Listening · next: ${NAMES[next]}` : 'Tap to dictate'

  return (
    <div className="shrink-0 bg-c200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-5 px-4 py-4 lg:px-8">
        <div className="relative size-15 shrink-0 lg:size-13">
          {/* level ring: square behind the button, only transform animates */}
          <span ref={ring} aria-hidden className="pointer-events-none absolute inset-0 bg-hot/30 transition-transform duration-75" />
          <button
            onClick={active ? t.stop : t.start}
            aria-label={active ? 'Stop microphone' : 'Start microphone'}
            aria-pressed={active}
            className={`relative flex size-full items-center justify-center ${t.live ? 'bg-hot text-on-hot' : t.connecting ? 'breathe bg-c300 text-ink' : 'bg-c50 text-ink'}`}
          >
            <Mic className="size-7" />
          </button>
        </div>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="t-small text-mute">{status}</p>
          <p className={`min-h-7 font-serif text-lg italic ${notice ? 'text-hot-text' : 'truncate text-mute'}`}>{notice ?? t.interim}</p>
        </div>
      </div>
    </div>
  )
}
