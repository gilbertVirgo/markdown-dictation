import { Extension } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { HeadingBlock, HeadingSuggestion } from '../lib/headingsPrompt'

// Suggested headings: drawn as widgets between blocks, never in the doc (not saved, no undo) until kept.
type Item = { id: number; pos: number; level: 2 | 3; text: string }
type State = { anchors: number[]; items: Item[] }
type Meta = { anchor: true } | { suggest: HeadingSuggestion[] } | { drop: number[] }

export const suggestionsKey = new PluginKey<State>('suggestions')
let nextId = 1

// one entry per top-level block, as the model sees them
export function headingBlocks(doc: Node): HeadingBlock[] {
  const out: HeadingBlock[] = []
  doc.forEach((n) => {
    const name = n.type.name
    const type: HeadingBlock['type'] = name === 'heading' ? (`h${n.attrs.level}` as 'h1')
      : name === 'paragraph' ? (n.content.size ? 'p' : 'blank')
      : name === 'bulletList' || name === 'orderedList' ? 'list'
      : name === 'blockquote' ? 'quote' : 'other'
    out.push({ type, text: n.textContent })
  })
  return out
}

const starts = (doc: Node) => {
  const out: number[] = []
  doc.forEach((_, offset) => out.push(offset))
  return out
}

// a position stays usable while the block after it survives and isn't (or hasn't become) a heading
const placeable = (doc: Node, pos: number) => {
  const $p = doc.resolve(pos)
  return $p.depth === 0 && !!$p.nodeAfter && $p.nodeAfter.type.name !== 'heading' && $p.nodeBefore?.type.name !== 'heading'
}

const map = (tr: Transaction, pos: number) => {
  if (pos < 0) return -1
  const r = tr.mapping.mapResult(pos, 1)
  return r.deletedAfter ? -1 : r.pos
}

// Mark the current blocks as the ones the request numbers, so the reply lands on the right blocks even if you typed meanwhile.
export const anchorTr = (state: EditorState) => state.tr.setMeta(suggestionsKey, { anchor: true } satisfies Meta)
export const suggestTr = (state: EditorState, list: HeadingSuggestion[]) => state.tr.setMeta(suggestionsKey, { suggest: list } satisfies Meta)
export const dropTr = (state: EditorState, ids?: number[]) =>
  state.tr.setMeta(suggestionsKey, { drop: ids ?? suggestionsKey.getState(state)!.items.map((i) => i.id) } satisfies Meta)

export function keepTr(state: EditorState, ids?: number[]) {
  const { items } = suggestionsKey.getState(state)!
  const keep = items.filter((i) => !ids || ids.includes(i.id)).sort((a, b) => b.pos - a.pos) // last first: earlier positions stay valid
  const tr = state.tr
  const { heading } = state.schema.nodes
  for (const i of keep) tr.insert(i.pos, heading.create({ level: i.level }, state.schema.text(i.text)))
  return tr.setMeta(suggestionsKey, { drop: keep.map((i) => i.id) } satisfies Meta)
}

function widget(item: Item) {
  return (view: import('@tiptap/pm/view').EditorView) => {
    const box = document.createElement('div')
    box.className = 'suggested-heading'
    box.contentEditable = 'false'
    const h = document.createElement(`h${item.level}`)
    h.textContent = item.text
    const button = (label: string, icon: string, tr: () => Transaction) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.setAttribute('aria-label', `${label} heading “${item.text}”`)
      b.innerHTML = icon
      b.onmousedown = (e) => e.preventDefault() // keep the editor's selection
      b.onclick = () => view.dispatch(tr())
      return b
    }
    const tag = document.createElement('span')
    tag.className = 'level'
    tag.textContent = `H${item.level}`
    box.append(tag, h,
      button('Keep', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>', () => keepTr(view.state, [item.id])),
      button('Drop', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>', () => dropTr(view.state, [item.id])))
    return box
  }
}

export const Suggestions = Extension.create({
  name: 'suggestions',
  addProseMirrorPlugins() {
    return [
      new Plugin<State>({
        key: suggestionsKey,
        state: {
          init: () => ({ anchors: [], items: [] }),
          apply(tr, prev, _old, state) {
            const meta = tr.getMeta(suggestionsKey) as Meta | undefined
            let { anchors, items } = prev
            if (tr.docChanged && anchors.length) anchors = anchors.map((p) => map(tr, p))
            if (tr.docChanged && items.length) {
              items = items.flatMap((i) => {
                const pos = map(tr, i.pos)
                return pos >= 0 && placeable(state.doc, pos) ? [{ ...i, pos }] : []
              })
            }
            if (meta && 'anchor' in meta) anchors = starts(state.doc)
            if (meta && 'suggest' in meta) {
              // a new run replaces the last one
              items = meta.suggest.flatMap((s) => {
                const pos = anchors[s.before] ?? -1
                return pos >= 0 && placeable(state.doc, pos) ? [{ id: nextId++, pos, level: s.level, text: s.text }] : []
              })
              anchors = []
            }
            if (meta && 'drop' in meta) items = items.filter((i) => !meta.drop.includes(i.id))
            return anchors === prev.anchors && items === prev.items ? prev : { anchors, items }
          },
        },
        props: {
          decorations(state) {
            const { items } = suggestionsKey.getState(state)!
            if (!items.length) return null
            return DecorationSet.create(state.doc, items.map((i) =>
              Decoration.widget(i.pos, widget(i), { side: -1, key: `${i.id}`, ignoreSelection: true, stopEvent: () => true })))
          },
        },
      }),
    ]
  },
})
