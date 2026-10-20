import { Extension } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

// A level is an `indent` attribute drawn as padding. Markdown has no paragraph indent, so it's saved as
// two em spaces per level at the start of the block (getMarkdown writes them as &emsp;, other renderers show space).
export const indentPrefix = (n: Node) => ' '.repeat((n.attrs.indent ?? 0) * 2)
const level = (n: Node): number => n.attrs.indent ?? 0

// every indentable block the selection touches, in document order
function blocks(tr: Transaction) {
  const out: { pos: number; node: Node }[] = []
  tr.doc.nodesBetween(tr.selection.from, tr.selection.to, (node, pos) => {
    if (!node.isTextblock) return
    if ('indent' in node.attrs) out.push({ pos, node })
    return false
  })
  return out
}

// indent level of the last textblock ending before pos (0 at the top of the doc)
function levelBefore(doc: Node, pos: number) {
  let l = 0
  doc.nodesBetween(0, pos, (n, at) => {
    if (!n.isTextblock) return
    if (at + n.nodeSize <= pos) l = level(n)
    return false
  })
  return l
}

// Lists keep their own Tab/Shift-Tab (nest/un-nest) and Enter: returning false falls through to ListItem.
export const Indent = Extension.create({
  name: 'indent',
  priority: 1000,
  addGlobalAttributes: () => [
    {
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el) => Number(el.getAttribute('data-indent')) || 0,
          renderHTML: ({ indent }) => (indent > 0 ? { 'data-indent': indent, style: `padding-left: ${indent * 2}em` } : {}),
        },
      },
    },
  ],
  // markdown-it decodes &emsp; to U+2003: turn the leading pairs back into the attribute (an odd one is dropped)
  addStorage: () => ({
    markdown: {
      parse: {
        updateDOM: (el: HTMLElement) =>
          el.querySelectorAll('p, h1, h2, h3').forEach((b) => {
            const t = b.ownerDocument.createTreeWalker(b, NodeFilter.SHOW_TEXT).nextNode()
            const k = t?.textContent!.match(/^ */)![0].length
            if (!k) return
            t!.textContent = t!.textContent!.slice(k)
            if (k > 1) b.setAttribute('data-indent', String(k >> 1))
          }),
      },
    },
  }),
  addKeyboardShortcuts() {
    // at most one level deeper than the block before; each block sees the one before's new level
    const indent = () =>
      this.editor.commands.command(({ tr }) => {
        const bs = blocks(tr)
        let prev = bs.length ? levelBefore(tr.doc, bs[0].pos) : 0
        for (const { pos, node } of bs) {
          const l = level(node)
          prev = l <= prev ? l + 1 : l
          if (prev > l) tr.setNodeAttribute(pos, 'indent', prev)
        }
        return true
      })
    const outdent = () =>
      this.editor.commands.command(({ tr }) => {
        for (const { pos, node } of blocks(tr)) if (level(node)) tr.setNodeAttribute(pos, 'indent', level(node) - 1)
        return true
      })
    const inList = () => this.editor.isActive('listItem')
    return {
      Tab: () => !inList() && indent(),
      'Shift-Tab': () => !inList() && outdent(), // outdent is always true: never move focus out of the editor
      // always handled: unhandled, Cmd-[ / Cmd-] is browser back/forward
      'Mod-]': () => (inList() ? this.editor.commands.sinkListItem('listItem') : indent(), true),
      'Mod-[': () => (inList() ? this.editor.commands.liftListItem('listItem') : outdent(), true),
      // at the start of an indented block, Backspace drops a level before it joins anything
      Backspace: () => {
        const { $from, empty } = this.editor.state.selection
        if (inList() || !empty || $from.parentOffset || !level($from.parent)) return false
        return outdent()
      },
      // Enter needs nothing: splitBlock keeps global attributes, so the new block carries the indent
    }
  },
})
