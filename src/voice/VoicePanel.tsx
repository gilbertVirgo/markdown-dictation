import { useRef, useState } from 'react'
import type { BlockType } from '../editor/Editor'
import { useTranscriber } from './useTranscriber'
import { isSupported } from './engines/webspeech'
import type { Settings } from '../lib/settings'
import { Mic } from '../ui/icons'

const BLOCKS: [BlockType, string][] = [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['body', 'Body'], ['quote', 'Quote']]

export function VoicePanel({ onChunk, vocabulary, settings }: {
  onChunk(text: string, block: BlockType): void
  vocabulary: () => string[]
  settings: Settings
}) {
  const [pendingBlock, setPendingBlock] = useState<BlockType>('body')
  // ref so back-to-back finals before a re-render don't both land in the selected block
  const blockRef = useRef(pendingBlock)
  const pick = (b: BlockType) => setPendingBlock((blockRef.current = b))
  const ring = useRef<HTMLSpanElement>(null)

  const t = useTranscriber({
    engine: settings.engine,
    lang: settings.lang,
    vocabulary,
    onFinal(text) {
      onChunk(text, blockRef.current)
      pick('body')
    },
    onLevel(level) {
      if (ring.current) ring.current.style.transform = `scale(${1 + level * 0.45})`
    },
  })

  const notice = settings.engine === 'webspeech' && !isSupported()
    ? 'Speech recognition isn’t supported in this browser. Try Chrome or Safari, or pick another engine.'
    : t.error

  const status = notice ? 'Mic error' : t.connecting ? 'Connecting' : t.live ? 'Listening' : 'Tap to dictate'

  return (
    // two tiers: mic + transcript, then the next-block picker
    <div className="shrink-0 bg-c100 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-5 bg-c200 px-4 py-4 lg:px-8">
        <div className="relative size-15 shrink-0 lg:size-13">
          {/* level ring: square behind the button, only transform animates */}
          <span ref={ring} aria-hidden className="pointer-events-none absolute inset-0 bg-hot/30 transition-transform duration-75" />
          <button
            onClick={t.live ? t.stop : t.start}
            aria-label={t.live ? 'Stop microphone' : 'Start microphone'}
            aria-pressed={t.live}
            className={`relative flex size-full items-center justify-center text-ink ${t.live ? 'bg-hot' : t.connecting ? 'breathe bg-c300' : 'bg-c50'}`}
          >
            <Mic className="size-7" />
          </button>
        </div>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="t-small text-mute">{status}</p>
          <p className={`min-h-7 font-serif text-lg italic ${notice ? 'text-hot-text' : 'truncate text-mute'}`}>{notice ?? t.interim}</p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Next block type" className="flex items-center px-4 lg:px-8">
        <span aria-hidden className="t-small mr-3 hidden shrink-0 text-mute sm:inline">Next block</span>
        {BLOCKS.map(([b, label]) => (
          <button
            key={b}
            role="radio"
            aria-checked={pendingBlock === b}
            onClick={() => pick(b)}
            className={`t-small min-h-11 flex-1 px-3.5 sm:flex-none ${pendingBlock === b ? 'bg-ink text-c50' : 'text-mute hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
