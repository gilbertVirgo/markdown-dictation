import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
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
  insertChunk(text: string, block: BlockType, pendingId: string): boolean
  replacePending(pendingId: string, text: string): void
  clearPending(pendingId: string): void
  scrollToEnd(): void
}

// Shared with tests/unit/editor.test.ts so both build the same schema.
export const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
  Link.configure({ openOnClick: false }),
  Markdown.configure({ transformPastedText: true, breaks: true }),
  PendingMark,
]

export const Editor = forwardRef<EditorHandle, { initial: string; editable: boolean; onChange(md: string): void }>(
  function Editor({ initial, editable, onChange }, ref) {
    const editor = useEditor({
      extensions,
      content: initial,
      editable,
      onUpdate: ({ editor }) => onChange(getMarkdown(editor)),
    })
    const scroller = useRef<HTMLDivElement>(null)

    useEffect(() => {
      editor?.setEditable(editable, false)
    }, [editor, editable])

    useImperativeHandle(ref, () => ({
      getMarkdown: () => (editor ? getMarkdown(editor) : initial),
      insertChunk: (text, block, pendingId) => !!editor && insertChunk(editor, text, block, pendingId),
      replacePending: (pendingId, text) => editor && replacePending(editor, pendingId, text),
      clearPending: (pendingId) => editor && clearPending(editor, pendingId),
      scrollToEnd: () => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }),
    }), [editor, initial])

    return (
      <>
        {/* only this scrolls; the toolbar below stays pinned above the keyboard */}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto [scroll-padding-bottom:3rem]">
          <EditorContent editor={editor} className="px-4 py-4" />
        </div>
        {editable && editor && <Toolbar editor={editor} />}
      </>
    )
  },
)

// tiptap-markdown doesn't augment tiptap v3's Storage type
export const getMarkdown = (editor: TiptapEditor): string =>
  (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()

// Body text continues the last paragraph; anything else (or a picked block type) starts a new block.
// Returns false (nothing inserted) for blank text: ProseMirror rejects empty text nodes.
export function insertChunk(editor: TiptapEditor, text: string, block: BlockType, pendingId: string): boolean {
  if (!text.trim() && !text.includes('\n')) return false
  const content = [{ type: 'text', text, marks: [{ type: 'pending', attrs: { id: pendingId, block } }] }]
  const { doc } = editor.state
  const last = doc.lastChild
  const end = doc.content.size
  if (block === 'body' && last?.type.name === 'paragraph' && last.content.size > 0) {
    const sep = /\s$/.test(last.textContent) || last.lastChild?.type.name === 'hardBreak' ? [] : [{ type: 'text', text: ' ' }]
    editor.commands.insertContentAt(end - 1, [...sep, ...content])
    return true
  }
  const node =
    block === 'body' ? { type: 'paragraph', content }
    : block === 'quote' ? { type: 'blockquote', content: [{ type: 'paragraph', content }] }
    : { type: 'heading', attrs: { level: Number(block[1]) }, content }
  // replace the empty trailing paragraph (StarterKit TrailingNode) instead of appending after it
  const from = last?.type.name === 'paragraph' && last.content.size === 0 ? end - last.nodeSize : end
  editor.commands.insertContentAt({ from, to: end }, node)
  return true
}

const BLOCK_START = /^\s*([-*+] |\d+\. |#{1,6} |> )/
const HAS_MARKDOWN = /\n|^\s*([-*+] |\d+\. |#{1,6} |> )|\*\*|__|\[[^\]]+\]\(/
// leading/trailing "new paragraph" (\n\n) or "new line" (\n) the markdown parser would drop
const edge = (s: string | undefined) => (s === undefined ? null : /\n[ \t]*\n/.test(s) ? 'p' : 'br')

export function replacePending(editor: TiptapEditor, pendingId: string, raw: string) {
  const r = pendingRange(editor, pendingId)
  if (!r) return
  const { schema } = editor
  const type = schema.marks.pending
  if (!raw.trim()) {
    if (!raw.includes('\n')) {
      editor.view.dispatch(editor.state.tr.removeMark(r.from, r.to, type)) // keep raw text
      return
    }
    // bare "new line" / "new paragraph": swap the pending text (and insertChunk's separator) for a real break
    let from = r.from
    if (editor.state.doc.textBetween(from - 1, from) === ' ') from--
    const tr = editor.state.tr.delete(from, r.to)
    if (/\n\s*\n/.test(raw)) tr.split(from)
    else tr.insert(from, schema.nodes.hardBreak.create())
    editor.view.dispatch(tr)
    return
  }
  if (!HAS_MARKDOWN.test(raw)) {
    const tr = editor.state.tr.insertText(raw, r.from, r.to)
    editor.view.dispatch(tr.removeMark(r.from, r.from + raw.length, type))
    return
  }
  const text = raw.trim()
  const { doc } = editor.state
  const $from = doc.resolve(r.from), $to = doc.resolve(r.to)
  const whole = $from.sameParent($to) && $from.parentOffset === 0 && $to.parentOffset === $to.parent.content.size

  if (r.block !== 'body' && whole) {
    // heading/quote: replace the whole block, re-adding the prefix (model sometimes ignores the no-prefix rule)
    const body = text.replace(/^(#{1,6}|>) /, '')
    const quote = r.block === 'quote'
    const depth = ($p: typeof $from) => {
      if (quote) for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'blockquote') return d
      return $p.depth
    }
    const markdown = quote
      ? body.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n')
      : '#'.repeat(Number(r.block[1])) + ' ' + body
    editor.commands.insertContentAt({ from: $from.before(depth($from)), to: $to.after(depth($to)) }, markdown)
    return
  }

  // body: replace only the pending range, so earlier sentences in the paragraph survive
  const lead = $from.parentOffset > 0 ? edge(raw.match(/^\s*\n/)?.[0]) : null
  const trail = edge(raw.match(/\n\s*$/)?.[0])
  let from = r.from
  const tr = editor.state.tr
  // drop the separator insertChunk added when the result starts a new block
  if ((lead || BLOCK_START.test(text)) && doc.textBetween(from - 1, from) === ' ') from--
  tr.delete(from, r.to)
  if (lead === 'p') tr.split(from), (from += 2)
  else if (lead === 'br') tr.insert(from, schema.nodes.hardBreak.create()), from++
  editor.view.dispatch(tr)
  editor
    .chain()
    .insertContentAt(from, text)
    .command(({ tr }) => {
      const end = tr.mapping.map(from, 1)
      const inText = tr.doc.resolve(end).parent.isTextblock
      if (trail === 'p') inText ? tr.split(end) : tr.insert(end, schema.nodes.paragraph.create())
      else if (trail === 'br' && inText) tr.insert(end, schema.nodes.hardBreak.create())
      return true
    })
    .run()
}

export function clearPending(editor: TiptapEditor, pendingId: string) {
  const r = pendingRange(editor, pendingId)
  if (r) editor.view.dispatch(editor.state.tr.removeMark(r.from, r.to, editor.schema.marks.pending))
}

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
