import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import Toolbar from './Toolbar'
import { PendingMark } from './PendingMark'
import type { BlockType } from '../lib/refinePrompt'

export type { BlockType } from '../lib/refinePrompt'
export type EditorHandle = {
  getMarkdown(): string
  insertChunk(text: string, block: BlockType, pendingId: string): void
  replacePending(pendingId: string, text: string): void
  clearPending(pendingId: string): void
}

export const Editor = forwardRef<EditorHandle, { initial: string; editable: boolean; onChange(md: string): void }>(
  function Editor({ initial, editable, onChange }, ref) {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
        Link.configure({ openOnClick: false }),
        Markdown.configure({ transformPastedText: true }),
        PendingMark,
      ],
      content: initial,
      editable,
      onUpdate: ({ editor }) => onChange(md(editor)),
    })

    useEffect(() => {
      editor?.setEditable(editable, false)
    }, [editor, editable])

    useImperativeHandle(ref, () => ({
      getMarkdown: () => (editor ? md(editor) : initial),
      insertChunk(text, block, pendingId) {
        if (!editor) return
        const content = [{ type: 'text', text, marks: [{ type: 'pending', attrs: { id: pendingId, block } }] }]
        const node =
          block === 'body' ? { type: 'paragraph', content }
          : block === 'quote' ? { type: 'blockquote', content: [{ type: 'paragraph', content }] }
          : { type: 'heading', attrs: { level: Number(block[1]) }, content }
        // replace the empty trailing paragraph (StarterKit TrailingNode) instead of appending after it
        const { doc } = editor.state
        const last = doc.lastChild
        const end = doc.content.size
        const from = last?.type.name === 'paragraph' && last.content.size === 0 ? end - last.nodeSize : end
        editor.chain().insertContentAt({ from, to: end }, node).focus('end').run()
      },
      replacePending(pendingId, text) {
        if (!editor) return
        const r = pendingRange(editor, pendingId)
        if (!r) return
        const type = editor.schema.marks.pending
        if (!text.trim()) {
          editor.view.dispatch(editor.state.tr.removeMark(r.from, r.to, type)) // keep raw text
          return
        }
        if (!text.includes('\n')) {
          const tr = editor.state.tr.insertText(text, r.from, r.to)
          editor.view.dispatch(tr.removeMark(r.from, r.from + text.length, type))
          return
        }
        // multi-line: replace the whole enclosing block with parsed markdown (tiptap-markdown parses strings here)
        const { doc } = editor.state
        const $from = doc.resolve(r.from), $to = doc.resolve(r.to)
        const quote = r.block === 'quote'
        const depth = ($p: typeof $from) => {
          if (quote) for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'blockquote') return d
          return $p.depth
        }
        const lines = text.split('\n')
        const markdown =
          quote ? lines.map((l) => (l ? '> ' + l : '>')).join('\n')
          : r.block === 'body' ? text
          : '#'.repeat(Number(r.block[1])) + ' ' + text
        editor.chain().insertContentAt({ from: $from.before(depth($from)), to: $to.after(depth($to)) }, markdown).run()
      },
      clearPending(pendingId) {
        if (!editor) return
        const r = pendingRange(editor, pendingId)
        if (r) editor.view.dispatch(editor.state.tr.removeMark(r.from, r.to, editor.schema.marks.pending))
      },
    }), [editor, initial])

    return (
      <>
        <EditorContent editor={editor} className="px-4 py-4" />
        {editable && editor && <Toolbar editor={editor} />}
      </>
    )
  },
)

// tiptap-markdown doesn't augment tiptap v3's Storage type
const md = (editor: TiptapEditor): string =>
  (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()

// span of all text carrying pending mark `id` (onUpdate fires on dispatch, so onChange runs)
function pendingRange(editor: TiptapEditor, id: string): { from: number; to: number; block: BlockType } | null {
  let from = Infinity, to = -1, block: BlockType = 'body'
  editor.state.doc.descendants((node, pos) => {
    const m = node.isText && node.marks.find((m) => m.type.name === 'pending' && m.attrs.id === id)
    if (m) {
      from = Math.min(from, pos)
      to = Math.max(to, pos + node.nodeSize)
      block = m.attrs.block ?? 'body'
    }
  })
  return to < 0 ? null : { from, to, block }
}
