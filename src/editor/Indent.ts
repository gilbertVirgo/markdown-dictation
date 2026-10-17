import { Extension } from '@tiptap/core'

// Markdown has no paragraph indent, so a level is two em spaces of text: getMarkdown writes them as &emsp;
// (which markdown-it decodes back on load, and other markdown renderers show as space).
export const TAB = '\u2003\u2003'
const leading = (text: string) => text.match(/^\u2003*/)![0]

// Lists keep their own Tab/Shift-Tab (nest/un-nest) and Enter: returning false falls through to ListItem.
export const Indent = Extension.create({
  name: 'indent',
  priority: 1000,
  addKeyboardShortcuts() {
    // raw insertText: insertContent would run the string through tiptap-markdown's parser
    const insert = (text: string) => this.editor.commands.command(({ tr }) => (tr.insertText(text), true))
    const inList = () => this.editor.isActive('listItem')
    return {
      Tab: () => !inList() && insert(TAB),
      'Shift-Tab': () => {
        if (inList()) return false
        const { $from } = this.editor.state.selection
        const n = Math.min(leading($from.parent.textContent).length, TAB.length)
        const start = $from.start()
        if (n) this.editor.commands.deleteRange({ from: start, to: start + n })
        return true // never move focus out of the editor
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
})
