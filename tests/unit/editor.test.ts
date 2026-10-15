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
  expect(insertChunk(ed, '\n', 'body', 'a')).toBe(true)
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
  expect(insertChunk(ed, '  ', 'body', 'a')).toBe(false)
  expect(getMarkdown(ed)).toBe('First.')
})
