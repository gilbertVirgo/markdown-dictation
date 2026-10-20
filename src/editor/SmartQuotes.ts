import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'

// Smart quotes and dashes in whatever text a change touched: typed, pasted or dictated (dictation inserts text
// directly, so input rules never see it). Each change is widened to whole words and re-checked, so "'til" turns its
// opening quote into an apostrophe once the word is complete. Docs loaded as-is keep their text until edited.
// Quotes open after a block start, space or opening bracket/dash/quote, and close (or are apostrophes) otherwise.
// "--" becomes an em dash, a hyphen between spaces an en dash; a line of only hyphens is left for the markdown rule.
const OPENS_AFTER = /^$|[\s([{\u2014\u2013\u201c\u2018\ufffc]/
// words that start with an apostrophe, not an opening quote: 'tis, 'til, rock 'n' roll, the '90s
const ELIDED = /^(?:tis|twas|til|cause|cos|em|bout|n|nuff|\d\ds?)(?![\p{L}\p{N}])/iu
const DOUBLE = '"\u201c\u201d', SINGLE = "'\u2018\u2019"

export const smartQuotesKey = new PluginKey('smartQuotes')

export const SmartQuotes = Extension.create({
  name: 'smartQuotes',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: smartQuotesKey,
        appendTransaction(trs, _old, state) {
          if (!trs.some((t) => t.docChanged)) return null
          const edits = new Map<number, [number, string]>() // pos → [length replaced, text]
          for (const [from, to] of trs.flatMap(changedRanges(trs)))
            state.doc.nodesBetween(from, to, (node, pos) => {
              if (!node.isTextblock) return true
              if (!node.type.spec.code) fix(node, pos + 1, from, to, edits)
              return false
            })
          if (!edits.size) return null
          const tr = state.tr
          for (const [pos, [len, text]] of [...edits].sort((a, b) => b[0] - a[0]))
            tr.replaceWith(pos, pos + len, state.schema.text(text, state.doc.nodeAt(pos)!.marks))
          return tr.setMeta(smartQuotesKey, true)
        },
      }),
    ]
  },
})

// one textblock starting at `start`; leaves (hard breaks) read as \ufffc so string offsets stay doc offsets
function fix(block: PMNode, start: number, from: number, to: number, edits: Map<number, [number, string]>) {
  const text = block.textBetween(0, block.content.size, undefined, '\ufffc')
  let lo = Math.max(from - start, 0), hi = Math.min(to - start, text.length)
  while (lo > 0 && !/\s/.test(text[lo - 1])) lo--
  while (hi < text.length && !/\s/.test(text[hi])) hi++
  const onlyHyphens = /^-+$/.test(text)
  for (let i = lo; i < hi; i++) {
    const c = text[i], prev = text[i - 1] ?? '', next = text[i + 1] ?? ''
    if (block.nodeAt(i)?.marks.some((m) => m.type.spec.code)) continue
    const open = OPENS_AFTER.test(prev)
    let want: string | null = null, len = 1
    if (DOUBLE.includes(c)) want = open ? '\u201c' : '\u201d'
    else if (SINGLE.includes(c)) want = open && !ELIDED.test(text.slice(i + 1)) ? '\u2018' : '\u2019'
    else if (c === '-' && !onlyHyphens && next === '-') (want = '\u2014'), (len = 2), i++
    else if (c === '-' && prev === ' ' && next === ' ' && i > 1) want = '\u2013'
    if (want && want !== text.slice(i - len + 1, i + 1)) edits.set(start + i - len + 1, [len, want])
  }
}

// each transaction's inserted ranges, mapped forward into the final doc
const changedRanges = (trs: readonly Transaction[]) => (t: Transaction, ti: number) => {
  const out: [number, number][] = []
  t.mapping.maps.forEach((map, mi) => {
    map.forEach((_a, _b, from, to) => {
      for (let j = mi + 1; j < t.mapping.maps.length; j++) (from = t.mapping.maps[j].map(from, -1)), (to = t.mapping.maps[j].map(to, 1))
      for (const later of trs.slice(ti + 1)) (from = later.mapping.map(from, -1)), (to = later.mapping.map(to, 1))
      out.push([from, to])
    })
  })
  return out
}
