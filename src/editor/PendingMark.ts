import { Mark } from '@tiptap/react'

export const PendingMark = Mark.create({
  name: 'pending',
  inclusive: false,
  addAttributes: () => ({
    id: {
      default: null,
      parseHTML: (el) => el.getAttribute('data-pending'),
      renderHTML: (attrs) => ({ 'data-pending': attrs.id }),
    },
    block: { default: 'body', rendered: false },
  }),
  parseHTML: () => [{ tag: 'span[data-pending]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', { ...HTMLAttributes, class: 'text-muted' }, 0],
  // tiptap-markdown would otherwise serialise unknown marks as raw HTML spans
  addStorage: () => ({ markdown: { serialize: { open: '', close: '' } } }),
})
