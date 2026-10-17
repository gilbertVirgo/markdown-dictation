// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import { extensions, getMarkdown, insertChunk, replacePending } from '../../src/editor/Editor'

let ed: Editor
const make = (content = '') => (ed = new Editor({ extensions, content }))
const types = () => ed.getJSON().content!.map((n) => n.type)
afterEach(() => ed.destroy())

it('body chunk appends to the existing paragraph', () => {
  make('First sentence.')
  insertChunk(ed, 'second one', 'body', 'a')
  expect(types()).toEqual(['paragraph'])
  expect(ed.getHTML()).toContain('data-pending="a"')
  replacePending(ed, 'a', 'Second one.')
  expect(getMarkdown(ed)).toBe('First sentence. Second one.')
})

it('h2 chunk makes a new heading, next body chunk a new paragraph', () => {
  make('Intro.')
  insertChunk(ed, 'next part', 'h2', 'a')
  replacePending(ed, 'a', '## Next part') // model ignored the no-prefix rule
  insertChunk(ed, 'some text', 'body', 'b')
  expect(types()).toEqual(['paragraph', 'heading', 'paragraph'])
  expect(getMarkdown(ed)).toBe('Intro.\n\n## Next part\n\nsome text')
})

it('replacePending with a single-line list yields a bulletList', () => {
  make('')
  insertChunk(ed, 'bullet point buy milk', 'body', 'a')
  replacePending(ed, 'a', '- Buy milk')
  expect(types()[0]).toBe('bulletList')
  expect(getMarkdown(ed)).toBe('- Buy milk')
})

it('a list dictated after prose starts its own block, earlier text intact', () => {
  make('Shopping.')
  insertChunk(ed, 'bullet point buy milk', 'body', 'a')
  replacePending(ed, 'a', '- Buy milk')
  expect(types().slice(0, 2)).toEqual(['paragraph', 'bulletList']) // + empty trailing paragraph
  expect(getMarkdown(ed)).toBe('Shopping.\n\n- Buy milk')
})

it('replacePending with plain text replaces and clears the mark', () => {
  make('')
  insertChunk(ed, 'the knee higher', 'body', 'a')
  replacePending(ed, 'a', 'Nehemiah')
  expect(ed.getHTML()).toBe('<p>Nehemiah</p>')
})

it('trailing new paragraph survives and the next chunk fills it', () => {
  make('Earlier.')
  insertChunk(ed, 'end here new paragraph', 'body', 'a')
  replacePending(ed, 'a', 'End **here**.\n\n')
  insertChunk(ed, 'fresh start', 'body', 'b')
  expect(types()).toEqual(['paragraph', 'paragraph'])
  expect(getMarkdown(ed)).toBe('Earlier. End **here**.\n\nfresh start')
})

it('markdown never contains pending spans', () => {
  make('Hello')
  insertChunk(ed, 'world', 'body', 'a')
  insertChunk(ed, 'quoted', 'quote', 'b')
  expect(getMarkdown(ed)).not.toContain('data-pending')
  expect(getMarkdown(ed)).toBe('Hello world\n\n> quoted')
})

it('a lone "new line" chunk becomes a hardBreak', () => {
  make('First.')
  expect(insertChunk(ed, '\n', 'body', 'a')).toBe('inline')
  replacePending(ed, 'a', '\n')
  expect(ed.getJSON().content![0].content!.map((n) => n.type)).toEqual(['text', 'hardBreak'])
  expect(ed.getJSON().content![0].content![0].text).toBe('First.') // separator and raw text gone
})

it('a lone "new paragraph" chunk splits the paragraph', () => {
  make('First.')
  insertChunk(ed, '\n\n', 'body', 'a')
  replacePending(ed, 'a', '\n\n')
  insertChunk(ed, 'second', 'body', 'b')
  replacePending(ed, 'b', 'Second.')
  expect(types()).toEqual(['paragraph', 'paragraph'])
  expect(getMarkdown(ed)).toBe('First.\n\nSecond.')
})

it('blank chunk inserts nothing', () => {
  make('First.')
  expect(insertChunk(ed, '  ', 'body', 'a')).toBeNull()
  expect(getMarkdown(ed)).toBe('First.')
})

it('reports placement: inline when appended, block otherwise', () => {
  make('First')
  expect(insertChunk(ed, 'more', 'body', 'a')).toBe('inline')
  expect(insertChunk(ed, 'title', 'h2', 'b')).toBe('block')
  expect(insertChunk(ed, 'body', 'body', 'c')).toBe('block')
})

it('leading comma drops the separator space', () => {
  make('in fifty-two days')
  insertChunk(ed, 'and then', 'body', 'a')
  replacePending(ed, 'a', ', and then')
  expect(getMarkdown(ed)).toBe('in fifty-two days, and then')
})

it('leading full stop closes the sentence without a space', () => {
  make('in fifty-two days')
  insertChunk(ed, 'then we left', 'body', 'a')
  replacePending(ed, 'a', '. Then we left')
  expect(getMarkdown(ed)).toBe('in fifty-two days. Then we left')
})

it('leading punctuation drops the separator on the markdown path too', () => {
  make('in fifty-two days')
  insertChunk(ed, 'and then bold', 'body', 'a')
  replacePending(ed, 'a', ', and then **bold**')
  expect(getMarkdown(ed)).toBe('in fifty-two days, and then **bold**')
})

it('"~" reopens the previous sentence with a word', () => {
  make('The wall was rebuilt.')
  insertChunk(ed, 'in fifty two days', 'body', 'a')
  replacePending(ed, 'a', '~in fifty-two days.')
  expect(getMarkdown(ed)).toBe('The wall was rebuilt in fifty-two days.')
})

it('"~" reopens the previous sentence with a comma', () => {
  make('The wall was rebuilt!')
  insertChunk(ed, 'and then', 'body', 'a')
  replacePending(ed, 'a', '~, and then')
  expect(getMarkdown(ed)).toBe('The wall was rebuilt, and then')
})

it('"~" with no terminal punctuation before is just stripped', () => {
  make('The wall was rebuilt')
  insertChunk(ed, 'in fifty two days', 'body', 'a')
  replacePending(ed, 'a', '~in **fifty-two** days')
  expect(getMarkdown(ed)).toBe('The wall was rebuilt in **fifty-two** days')
})

it('"~" on a new block is stripped and the previous block untouched', () => {
  make('Intro.')
  insertChunk(ed, 'next part', 'h2', 'a')
  replacePending(ed, 'a', '~Next part')
  expect(getMarkdown(ed)).toBe('Intro.\n\n## Next part')
})

it('a lone "~" keeps the raw text and the previous punctuation', () => {
  make('Rebuilt.')
  insertChunk(ed, 'um', 'body', 'a')
  replacePending(ed, 'a', '~')
  expect(getMarkdown(ed)).toBe('Rebuilt. um')
})

const key = (key: string) => ed.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

it('indent survives a markdown round trip and carries over on Enter', () => {
  make('')
  ed.commands.focus()
  key('Tab')
  ed.commands.insertContent('First')
  key('Enter')
  ed.commands.insertContent('Second')
  const md = getMarkdown(ed)
  expect(md).toBe('&emsp;&emsp;First\n\n&emsp;&emsp;Second')
  make(md)
  expect(getMarkdown(ed)).toBe(md)
})

it('Backspace inside the indent removes one whole level', () => {
  make('')
  ed.commands.focus()
  key('Tab')
  key('Tab')
  key('Backspace')
  expect(getMarkdown(ed)).toBe('&emsp;&emsp;')
  key('Backspace')
  expect(getMarkdown(ed)).toBe('')
})
