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

  return (
    <div className="flex shrink-0 flex-col items-center gap-3 border-t border-fg bg-bg px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <p className="min-h-6 w-full truncate text-center text-fg italic" aria-live="polite">
        {notice ?? (t.interim || (t.live ? 'Listening…' : 'Tap to dictate'))}
      </p>

      <div className="relative my-2 size-[72px]">
        {/* level ring: solid circle behind the button, only transform animates */}
        <span ref={ring} aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-primary transition-transform duration-75" />
        <button
          onClick={t.live ? t.stop : t.start}
          aria-label={t.live ? 'Stop microphone' : 'Start microphone'}
          aria-pressed={t.live}
          className={`relative flex size-full items-center justify-center rounded-full border ${t.live ? 'border-primary bg-primary text-light' : 'border-fg bg-bg text-fg'}`}
        >
          <Mic className="size-8" />
        </button>
      </div>

      <div className="grid w-full grid-cols-5 gap-2" role="radiogroup" aria-label="Next block type">
        {BLOCKS.map(([b, label]) => (
          <button
            key={b}
            role="radio"
            aria-checked={pendingBlock === b}
            onClick={() => pick(b)}
            className={`min-h-14 border bg-bg font-semibold ${pendingBlock === b ? 'border-primary text-primary' : 'border-fg text-fg'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
