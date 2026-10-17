import type { ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { Link, List, Quote } from '../ui/icons'
import type { BlockType } from '../lib/refinePrompt'

// While dictating, the block buttons pick the next dictated chunk's type instead of formatting the cursor's block.
export type NextBlock = { block: BlockType; pick(b: BlockType): void }

export default function Toolbar({ editor, next }: { editor: Editor; next: NextBlock | null }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      link: e.isActive('link'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      quote: e.isActive('blockquote'),
      bullet: e.isActive('bulletList'),
    }),
  })

  function link() {
    const prev = editor.getAttributes('link').href as string | undefined
    const href = prompt('URL', prev ?? 'https://')
    if (href === null) return
    const c = editor.chain().focus().extendMarkRange('link')
    ;(href ? c.setLink({ href }) : c.unsetLink()).run()
  }

  const c = () => editor.chain().focus()
  const block = (b: BlockType, format: () => void) => () => (next ? next.pick(b) : format())
  const body = !(active.h1 || active.h2 || active.h3 || active.quote)
  const buttons: [string, ReactNode, () => void, boolean][] = [
    ['bold', 'B', () => c().toggleBold().run(), active.bold],
    ['italic', 'I', () => c().toggleItalic().run(), active.italic],
    ['link', <Link className="mx-auto size-5" />, link, active.link],
    ['h1', 'H1', block('h1', () => c().toggleHeading({ level: 1 }).run()), next ? next.block === 'h1' : active.h1],
    ['h2', 'H2', block('h2', () => c().toggleHeading({ level: 2 }).run()), next ? next.block === 'h2' : active.h2],
    ['h3', 'H3', block('h3', () => c().toggleHeading({ level: 3 }).run()), next ? next.block === 'h3' : active.h3],
    ['body', '¶', block('body', () => c().setParagraph().lift('blockquote').run()), next ? next.block === 'body' : body],
    ['quote', <Quote className="mx-auto size-5" />, block('quote', () => c().toggleBlockquote().run()), next ? next.block === 'quote' : active.quote],
    ['bullet', <List className="mx-auto size-5" />, () => c().toggleBulletList().run(), active.bullet],
  ]
  const isBlock = (k: string) => next && ['h1', 'h2', 'h3', 'body', 'quote'].includes(k)

  return (
    // desktop: lifted into the header row (DocPage's <main> is the positioned ancestor)
    <div className="flex shrink-0 overflow-x-auto bg-c100 lg:absolute lg:top-[env(safe-area-inset-top)] lg:left-15 lg:bg-transparent">
      {buttons.map(([k, label, run, on]) => (
        <button
          key={k}
          type="button"
          aria-label={isBlock(k) ? `next block: ${k}` : k}
          aria-pressed={on}
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          // tangerine = next dictated block; ink = the cursor's formatting
          className={`min-h-11 min-w-10 flex-1 px-2 text-[15px] lg:min-w-11 lg:flex-none ${k === 'bold' ? 'font-extrabold' : 'font-medium'} ${on ? (isBlock(k) ? 'bg-hot text-on-hot' : 'bg-ink text-c50') : 'text-ink hover:bg-c200'} ${k === 'italic' ? 'italic' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
