import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Paragraph from '@tiptap/extension-paragraph'
import { Markdown } from 'tiptap-markdown'
import Toolbar, { type NextBlock } from './Toolbar'
import { PendingMark } from './PendingMark'
import { Indent } from './Indent'
import { Phantom, phantomKey } from './Phantom'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { BlockType, Placement } from '../lib/refinePrompt'

export type { BlockType } from '../lib/refinePrompt'
export type EditorHandle = {
  getMarkdown(): string
  getText(): string
  insertChunk(text: string, block: BlockType, pendingId: string): Placement | null
  replacePending(pendingId: string, text: string): void
  clearPending(pendingId: string): void
  scrollToEnd(): void
  setPhantom(text: string): void
}

// Markdown collapses blank lines, so an empty paragraph (an extra line break) is written as &nbsp; and emptied again on load
const BlankParagraph = Paragraph.extend({
  addStorage: () => ({
    markdown: {
      serialize(state: { write(s: string): void; renderInline(n: PMNode): void; closeBlock(n: PMNode): void }, node: PMNode) {
        if (node.childCount) state.renderInline(node)
        else state.write('&nbsp;')
        state.closeBlock(node)
      },
      parse: {
        updateDOM: (el: HTMLElement) => el.querySelectorAll('p').forEach((p) => p.textContent === '\u00a0' && !p.children.length && (p.textContent = '')),
      },
    },
  }),
})

// Shared with tests/unit/editor.test.ts so both build the same schema.
export const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, paragraph: false }),
  BlankParagraph,
  Link.configure({ openOnClick: false }),
  Markdown.configure({ transformPastedText: true, breaks: true }),
  PendingMark,
  Indent,
  Phantom,
]

export const Editor = forwardRef<EditorHandle, { initial: string; onChange(md: string): void; editable?: boolean; next?: NextBlock | null }>(
  function Editor({ initial, onChange, editable = true, next = null }, ref) {
    const editor = useEditor({
      extensions,
      content: initial,
      onUpdate: ({ editor }) => onChange(getMarkdown(editor)),
    })
    const scroller = useRef<HTMLDivElement>(null)
    useEffect(() => editor?.setEditable(editable), [editor, editable])

    useImperativeHandle(ref, () => ({
      getMarkdown: () => (editor ? getMarkdown(editor) : initial),
      getText: () => editor?.getText({ blockSeparator: '\n' }) ?? '',
      insertChunk: (text, block, pendingId) => (editor ? insertChunk(editor, text, block, pendingId) : null),
      replacePending: (pendingId, text) => editor && replacePending(editor, pendingId, text),
      clearPending: (pendingId) => editor && clearPending(editor, pendingId),
      setPhantom: (text) => editor && !editor.isDestroyed && editor.view.dispatch(editor.state.tr.setMeta(phantomKey, text)),
      scrollToEnd: () => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }),
    }), [editor, initial])

    return (
      <>
        {/* only this scrolls; the toolbar below stays pinned above the keyboard */}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto [scroll-padding-bottom:3rem]">
          <EditorContent editor={editor} className="rise mx-auto w-full max-w-[42rem] px-4 py-4 lg:px-8 lg:py-10" />
        </div>
        {editor && editable && <Toolbar editor={editor} next={next} />}
      </>
    )
  },
)

// tiptap-markdown doesn't augment tiptap v3's Storage type
export const getMarkdown = (editor: TiptapEditor): string =>
  (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown().replace(/\u2003/g, '&emsp;')
    .replace(/(?:(?:^|\n\n)&nbsp;)+$/, '') // trailing blank lines: nothing to keep apart

// Body text continues the last paragraph; anything else (or a picked block type) starts a new block.
// Returns 'inline' when joined onto existing text, 'block' when it starts a new block or follows a line break,
// null (nothing inserted) for blank text: ProseMirror rejects empty text nodes.
export function insertChunk(editor: TiptapEditor, text: string, block: BlockType, pendingId: string): Placement | null {
  if (!text.trim() && !text.includes('\n')) return null
  const content = [{ type: 'text', text, marks: [{ type: 'pending', attrs: { id: pendingId, block } }] }]
  const { doc } = editor.state
  const last = doc.lastChild
  const end = doc.content.size
  if (block === 'body' && last?.type.name === 'paragraph' && last.content.size > 0) {
    const br = last.lastChild?.type.name === 'hardBreak'
    const sep = br || /\s$/.test(last.textContent) ? [] : [{ type: 'text', text: ' ' }]
    editor.commands.insertContentAt(end - 1, [...sep, ...content])
    return br ? 'block' : 'inline'
  }
  const node =
    block === 'body' ? { type: 'paragraph', content }
    : block === 'quote' ? { type: 'blockquote', content: [{ type: 'paragraph', content }] }
    : { type: 'heading', attrs: { level: Number(block[1]) }, content }
  // replace the empty trailing paragraph (StarterKit TrailingNode) instead of appending after it
  const from = last?.type.name === 'paragraph' && last.content.size === 0 ? end - last.nodeSize : end
  editor.commands.insertContentAt({ from, to: end }, node)
  return 'block'
}

// punctuation that hugs the previous word: drop insertChunk's separator space before it
const LEAD_PUNCT = /^[.,;:!?)\]…’”]/
const BLOCK_START = /^\s*([-*+] |\d+\. |#{1,6} |> )/
const HAS_MARKDOWN = /\n|^\s*([-*+] |\d+\. |#{1,6} |> )|\*\*|__|\[[^\]]+\]\(/
// leading/trailing "new paragraph" (\n\n) or "new line" (\n) the markdown parser would drop
const edge = (s: string | undefined) => (s === undefined ? null : /\n[ \t]*\n/.test(s) ? 'p' : 'br')

export function replacePending(editor: TiptapEditor, pendingId: string, raw: string) {
  let r = pendingRange(editor, pendingId)
  if (!r) return
  if (raw.startsWith('~')) {
    // "~": the model reopened a sentence it closed at a pause; drop that . ? ! before the separator
    raw = raw.slice(1)
    const { doc } = editor.state
    let at = r.from
    if (doc.textBetween(at - 1, at) === ' ') at--
    if (raw.trim() && doc.resolve(at).parentOffset > 0 && /[.?!]/.test(doc.textBetween(at - 1, at))) {
      editor.view.dispatch(editor.state.tr.delete(at - 1, at))
      r = pendingRange(editor, pendingId)!
    }
  }
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
    let from = r.from
    if (LEAD_PUNCT.test(raw) && editor.state.doc.textBetween(from - 1, from) === ' ') from--
    const tr = editor.state.tr.insertText(raw, from, r.to)
    editor.view.dispatch(tr.removeMark(from, from + raw.length, type))
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
  // drop the separator insertChunk added when the result starts a new block or with hugging punctuation
  if ((lead || BLOCK_START.test(text) || LEAD_PUNCT.test(text)) && doc.textBetween(from - 1, from) === ' ') from--
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
