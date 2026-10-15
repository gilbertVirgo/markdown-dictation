const strip = (s: string) => s.replace(/^[\s#>*\-`]+/, '').replace(/[*_`]/g, '').trim()

export function deriveTitle(markdown: string): string {
  const lines = markdown.split('\n')
  const h1 = lines.find((l) => /^# /.test(l))
  const t = strip(h1 ?? lines.find((l) => strip(l)) ?? '') || 'Untitled'
  return t.slice(0, 80)
}

const TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[.!?]/gu

export function extractVocabulary(markdown: string, max = 200): string[] {
  const out = new Set<string>()
  for (const line of markdown.split('\n')) {
    let start = true
    for (const w of line.match(TOKEN) ?? []) {
      if (/^[.!?]$/.test(w)) {
        start = true
        continue
      }
      const ok =
        w.length >= 4 &&
        ((/^\p{Lu}/u.test(w) && !start) || /['’-]/.test(w) || /[^\x00-\x7F]/.test(w))
      start = false
      if (ok) out.add(w)
      if (out.size >= max) return [...out]
    }
  }
  return [...out]
}
