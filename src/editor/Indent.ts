import { Extension } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { Plugin, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Markdown has no paragraph indent, so a level is two em spaces of text: getMarkdown writes them as &emsp;
// (which markdown-it decodes back on load, and other markdown renderers show as space).
export const TAB = '  '
const leading = (text: string) => text.match(/^ */)![0]
const level = (text: string) => Math.floor(leading(text).length / TAB.length)

// start of every textblock the selection touches, last first so earlier positions stay valid while editing
function blocks(tr: Transaction) {
  const out: { at: number; text: string }[] = []
  tr.doc.nodesBetween(tr.selection.from, tr.selection.to, (n, pos) => {
    if (!n.isTextblock) return
    out.unshift({ at: pos + 1, text: n.textContent })
    return false
  })
  return out
}

// indent level of the last textblock ending before pos (0 at the top of the doc)
function levelBefore(doc: Node, pos: number) {
  let l = 0
  doc.nodesBetween(0, pos, (n, at) => {
    if (!n.isTextblock) return
    if (at + n.nodeSize <= pos) l = level(n.textContent)
    return false
  })
  return l
}

// Lists keep their own Tab/Shift-Tab (nest/un-nest) and Enter: returning false falls through to ListItem.
export const Indent = Extension.create({
  name: 'indent',
  priority: 1000,
  addKeyboardShortcuts() {
    // raw insertText: insertContent would run the string through tiptap-markdown's parser
    // at most one level deeper than the block before
    const indent = () =>
      this.editor.commands.command(({ tr }) => {
        const bs = blocks(tr).reverse() // document order, so each block sees the one before's new level
        let prev = bs.length ? levelBefore(tr.doc, bs[0].at - 1) : 0
        const deeper = bs.map((b) => {
          const l = level(b.text)
          prev = l <= prev ? l + 1 : l
          return prev > l
        })
        for (let i = bs.length - 1; i >= 0; i--) if (deeper[i]) tr.insertText(TAB, bs[i].at)
        return true
      })
    const outdent = () =>
      this.editor.commands.command(({ tr }) => {
        for (const b of blocks(tr)) tr.delete(b.at, b.at + Math.min(leading(b.text).length, TAB.length))
        return true
      })
    const inList = () => this.editor.isActive('listItem')
    return {
      Tab: () => !inList() && indent(),
      'Shift-Tab': () => !inList() && outdent(), // outdent is always true: never move focus out of the editor
      // always handled: unhandled, Cmd-[ / Cmd-] is browser back/forward
      'Mod-]': () => (inList() ? this.editor.commands.sinkListItem('listItem') : indent(), true),
      'Mod-[': () => (inList() ? this.editor.commands.liftListItem('listItem') : outdent(), true),
      // a level is two characters: inside the indent, Backspace drops back to the previous level
      Backspace: () => {
        const { $from, empty } = this.editor.state.selection
        const off = $from.parentOffset
        if (inList() || !empty || !off || off > leading($from.parent.textContent).length) return false
        return this.editor.commands.deleteRange({ from: $from.pos - (off % TAB.length || TAB.length), to: $from.pos })
      },
      // carry the line's indent onto the next line
      Enter: () => {
        const { $from, empty } = this.editor.state.selection
        if (inList() || !empty || !$from.parent.isTextblock) return false
        const indent = leading($from.parent.textContent)
        if (!indent || $from.parentOffset < indent.length) return false
        return this.editor.chain().splitBlock().command(({ tr }) => (tr.insertText(indent), true)).run()
      },
    }
  },
  // --indent on indented blocks: index.css hangs the wrapped lines under the first line's text.
  // The em spaces get a box exactly that many em wide: Safari draws EB Garamond's at ~0.25em, Chrome at 1em.
  // ponytail: rescans the whole doc each render; map a cached set through transactions if long docs lag
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: ({ doc }) => {
            const decos: Decoration[] = []
            doc.descendants((n, pos) => {
              if (!n.isTextblock) return
              const k = leading(n.textContent).length
              if (k) decos.push(Decoration.node(pos, pos + n.nodeSize, { style: `--indent: ${k}` }), Decoration.inline(pos + 1, pos + 1 + k, { class: 'indent-ws', style: `--indent: ${k}` }))
              return false
            })
            return DecorationSet.create(doc, decos)
          },
        },
      }),
    ]
  },
})
