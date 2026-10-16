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
      className="inset-x-4 m-auto w-auto max-w-none bg-c200 p-0 text-ink backdrop:bg-[rgb(46_36_28/0.3)] sm:max-w-sm"
    >
      <form method="dialog" className="flex flex-col gap-4 p-4">
        <h2 className="t-big text-[40px]">Settings</h2>
        <div className="flex flex-col gap-1">
          <span className="t-small text-mute">Text size</span>
          <div role="radiogroup" aria-label="Text size" className="flex bg-c100">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={settings.size === s}
                onClick={() => update({ size: s })}
                className={`t-small min-h-11 flex-1 ${settings.size === s ? 'bg-ink text-c50' : 'text-ink'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="t-small text-mute">Voice engine</span>
          <select
            value={settings.engine}
            onChange={(e) => update({ engine: e.target.value as EngineName })}
            className="min-h-11 bg-c50 px-3 text-ink"
          >
            <option value="deepgram">Deepgram</option>
            <option value="webspeech">Browser (Web Speech)</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={settings.refine} onChange={(e) => update({ refine: e.target.checked })} className="size-5 accent-hot" />
          <span className="t-small">Refine with Claude</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="t-small text-mute">Language</span>
          <input ref={langInput} defaultValue={settings.lang} className="min-h-11 bg-c50 px-3 text-ink" />
        </label>
        <button className="t-small min-h-11 bg-ink text-c50">Done</button>
      </form>
    </dialog>
  )
}
