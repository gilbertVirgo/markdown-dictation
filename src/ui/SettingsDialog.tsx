import { useRef, type Ref } from 'react'
import { DEFAULTS, SIZES, type Settings } from '../lib/settings'
import type { EngineName } from '../voice/useTranscriber'

export function SettingsDialog({ ref, settings, update }: {
  ref: Ref<HTMLDialogElement>
  settings: Settings
  update(patch: Partial<Settings>): void
}) {
  const langInput = useRef<HTMLInputElement>(null) // applied on close so typing doesn't restart the mic per keystroke

  return (
    <dialog
      ref={ref}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      onClose={() => {
        const lang = langInput.current?.value.trim() || DEFAULTS.lang
        if (langInput.current) langInput.current.value = lang // show the normalised value next time
        if (lang !== settings.lang) update({ lang })
      }}
      className="m-auto w-[min(24rem,calc(100%-2rem))] border border-fg bg-bg p-0 text-fg backdrop:bg-transparent"
    >
      <form method="dialog" className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-semibold">Settings</h2>
        <div className="flex flex-col gap-1">
          Text size
          <div role="radiogroup" aria-label="Text size" className="flex">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={settings.size === s}
                onClick={() => update({ size: s })}
                className={`min-h-11 flex-1 border border-l-0 border-fg capitalize first:border-l ${settings.size === s ? 'bg-fg font-semibold text-bg' : ''}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          Voice engine
          <select
            value={settings.engine}
            onChange={(e) => update({ engine: e.target.value as EngineName })}
            className="min-h-11 border border-fg bg-bg px-3"
          >
            <option value="deepgram">Deepgram</option>
            <option value="webspeech">Browser (Web Speech)</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={settings.refine} onChange={(e) => update({ refine: e.target.checked })} className="size-5 accent-primary" />
          Refine with Claude
        </label>
        <label className="flex flex-col gap-1">
          Language
          <input ref={langInput} defaultValue={settings.lang} className="min-h-11 border border-fg bg-bg px-3" />
        </label>
        <button className="min-h-11 bg-primary font-semibold text-light">Done</button>
      </form>
    </dialog>
  )
}
