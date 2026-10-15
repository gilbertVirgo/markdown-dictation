import { useRef, useState } from 'react'
import type { BlockType } from '../editor/Editor'
import { useTranscriber } from './useTranscriber'
import { isSupported } from './engines/webspeech'
import type { Settings } from '../lib/settings'
import { Mic, MicOff } from '../ui/icons'

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

  const t = useTranscriber({
    engine: settings.engine,
    lang: settings.lang,
    vocabulary,
    onFinal(text) {
      onChunk(text, blockRef.current)
      pick('body')
    },
  })

  const hot = t.live && !t.muted
  const notice = settings.engine === 'webspeech' && !isSupported()
    ? 'Speech recognition isn’t supported in this browser. Try Chrome or Safari, or pick another engine.'
    : t.error

  return (
    <div className="flex shrink-0 flex-col items-center gap-3 border-t border-border bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <p className="min-h-6 w-full truncate text-center text-muted italic" aria-live="polite">
        {notice ?? (t.muted ? 'Muted' : t.interim || (t.live ? 'Listening…' : ''))}
      </p>

      <button
        onClick={t.live ? t.toggleMute : t.start} // not live (e.g. permission denied): tap retries
        aria-label={!t.live ? 'Start microphone' : t.muted ? 'Unmute microphone' : 'Mute microphone'}
        aria-pressed={!t.muted}
        className={`flex size-[72px] items-center justify-center rounded-full border border-border ${hot ? 'bg-primary text-white' : 'bg-surface text-fg'}`}
      >
        {t.muted ? <MicOff className="size-8" /> : <Mic className="size-8" />}
      </button>

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
    </div>
  )
}
