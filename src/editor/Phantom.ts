import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Words heard but not yet transcribed: drawn after the last block as a widget, never part of the doc (not saved, no undo).
export const phantomKey = new PluginKey<string>('phantom')

export const Phantom = Extension.create({
  name: 'phantom',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: phantomKey,
        state: { init: () => '', apply: (tr, text) => tr.getMeta(phantomKey) ?? text },
        props: {
          decorations(state) {
            const text = phantomKey.getState(state)
            if (!text) return null
            const { doc } = state
            const last = doc.lastChild
            // where insertChunk will put it: on the end of the last paragraph (or into the empty trailing one)
            const inline = last?.type.name === 'paragraph'
            const span = document.createElement('span')
            span.className = 'phantom'
            span.textContent = (inline && last.content.size && !/\s$/.test(last.textContent) ? ' ' : '') + text
            if (!inline) {
              const p = document.createElement('p')
              p.append(span)
              return DecorationSet.create(doc, [Decoration.widget(doc.content.size, p, { side: 1 })])
            }
            return DecorationSet.create(doc, [Decoration.widget(doc.content.size - 1, span, { side: 1 })])
          },
        },
      }),
    ]
  },
})
