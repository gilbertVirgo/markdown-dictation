import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import Toolbar from './Toolbar'

export type BlockType = 'h1' | 'h2' | 'h3' | 'body' | 'quote'
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
      // ponytail: stub until Task 5 — appends a block, pendingId ignored
      insertChunk(text, block) {
        if (!editor) return
        const content = { type: 'text', text }
        const node =
          block === 'body' ? { type: 'paragraph', content: [content] }
          : block === 'quote' ? { type: 'blockquote', content: [{ type: 'paragraph', content: [content] }] }
          : { type: 'heading', attrs: { level: Number(block[1]) }, content: [content] }
        editor.chain().insertContentAt(editor.state.doc.content.size, node).run()
      },
      replacePending() {},
      clearPending() {},
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
