import { useEditorState, type Editor } from '@tiptap/react'

export default function Toolbar({ editor }: { editor: Editor }) {
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
  const buttons: [keyof typeof active, string, () => void][] = [
    ['bold', 'B', () => c().toggleBold().run()],
    ['italic', 'I', () => c().toggleItalic().run()],
    ['link', 'Link', link],
    ['h1', 'H1', () => c().toggleHeading({ level: 1 }).run()],
    ['h2', 'H2', () => c().toggleHeading({ level: 2 }).run()],
    ['h3', 'H3', () => c().toggleHeading({ level: 3 }).run()],
    ['quote', '❝', () => c().toggleBlockquote().run()],
    ['bullet', '•', () => c().toggleBulletList().run()],
  ]

  return (
    <div className="sticky bottom-0 z-10 flex overflow-x-auto border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      {buttons.map(([k, label, run]) => (
        <button
          key={k}
          type="button"
          aria-label={k}
          aria-pressed={active[k]}
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          className={`min-h-11 min-w-11 flex-1 px-2 font-semibold ${active[k] ? 'text-primary' : 'text-fg'} ${k === 'italic' ? 'italic' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
