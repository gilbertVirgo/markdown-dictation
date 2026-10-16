import { useState } from 'react'
import type { EngineName } from '../voice/useTranscriber'

type Size = 'small' | 'medium' | 'large'
export type Settings = { engine: EngineName; refine: boolean; lang: string; size: Size }
const KEY = 'dictate.settings'
const ENGINE_NAMES: EngineName[] = ['webspeech', 'openai', 'deepgram']
export const SIZES: Size[] = ['small', 'medium', 'large']
export const DEFAULTS: Settings = { engine: 'deepgram', refine: true, lang: 'en-GB', size: 'medium' }

function loadSettings(): Settings {
  try {
    const s: Settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    if (!ENGINE_NAMES.includes(s.engine)) s.engine = DEFAULTS.engine
    if (!SIZES.includes(s.size)) s.size = DEFAULTS.size
    return s
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, set] = useState(loadSettings)
  function update(patch: Partial<Settings>) {
    set((prev) => {
      const s = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(s))
      } catch {}
      return s
    })
  }
  return [settings, update] as const
}
