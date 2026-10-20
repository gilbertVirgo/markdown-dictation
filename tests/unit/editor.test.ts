// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import { extensions, getMarkdown, insertChunk, replacePending } from '../../src/editor/Editor'
import { phantomKey } from '../../src/editor/Phantom'
import { anchorTr, dropTr, headingBlocks, keepTr, suggestTr, suggestionsKey } from '../../src/editor/Suggestions'

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

it('Backspace at the start of an indented block outdents before joining', () => {
  make('Top\n\n&emsp;&emsp;&emsp;&emsp;Next')
  ed.commands.focus('end')
  ed.commands.setTextSelection(ed.state.doc.content.size - 5) // start of "Next"
  key('Backspace')
  expect(getMarkdown(ed)).toBe('Top\n\n&emsp;&emsp;Next')
  key('Backspace')
  expect(getMarkdown(ed)).toBe('Top\n\nNext')
  key('Backspace')
  expect(getMarkdown(ed)).toBe('TopNext')
})

it('old em-space markdown loads as an indent attribute, not text', () => {
  make('&emsp;&emsp;Hi')
  const p = ed.state.doc.firstChild!
  expect(p.attrs.indent).toBe(1)
  expect(p.textContent).toBe('Hi')
})

it('heading indent survives a markdown round trip', () => {
  make('## &emsp;&emsp;&emsp;&emsp;Title')
  const h = ed.state.doc.firstChild!
  expect([h.type.name, h.attrs.indent, h.textContent]).toEqual(['heading', 2, 'Title'])
  expect(getMarkdown(ed)).toBe('## &emsp;&emsp;&emsp;&emsp;Title')
})

it('Tab and Mod-] indent the whole block from mid-text, Mod-[ outdents', () => {
  make('&emsp;&emsp;&emsp;&emsp;Top\n\nHello')
  ed.commands.focus('end')
  key('Tab')
  expect(getMarkdown(ed)).toContain('\n\n&emsp;&emsp;Hello')
  ed.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: ']', ctrlKey: true, bubbles: true })) // jsdom isn't a Mac: Mod is Ctrl
  expect(getMarkdown(ed)).toContain('\n\n&emsp;&emsp;&emsp;&emsp;Hello')
  const p = ed.view.dom.querySelectorAll('p')[1]!
  expect([p.dataset.indent, p.style.paddingLeft]).toEqual(['2', '4em'])
  ed.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: '[', ctrlKey: true, bubbles: true }))
  expect(getMarkdown(ed)).toContain('\n\n&emsp;&emsp;Hello')
})

it('indent goes at most one level deeper than the block before', () => {
  make('&emsp;&emsp;First\n\nSecond')
  ed.commands.focus('end')
  key('Tab')
  key('Tab')
  key('Tab')
  expect(getMarkdown(ed)).toBe('&emsp;&emsp;First\n\n&emsp;&emsp;&emsp;&emsp;Second')
  ed.commands.selectAll()
  key('Tab') // top block can't pass level 1; second is already one deeper
  expect(getMarkdown(ed)).toBe('&emsp;&emsp;First\n\n&emsp;&emsp;&emsp;&emsp;Second')
})

it('extra blank lines between paragraphs survive a markdown round trip', () => {
  make('')
  ed.commands.setContent('<p>A</p><p></p><p></p><p>B</p><p></p>')
  const md = getMarkdown(ed)
  expect(md).toBe('A\n\n&nbsp;\n\n&nbsp;\n\nB') // trailing blank dropped
  make(md)
  expect(ed.getHTML()).toBe('<p>A</p><p></p><p></p><p>B</p>')
})

it('phantom text shows after the last paragraph but is never saved', () => {
  make('Typed.')
  ed.view.dispatch(ed.state.tr.setMeta(phantomKey, 'heard words'))
  expect(ed.view.dom.querySelector('.phantom')!.textContent).toBe(' heard words')
  expect(getMarkdown(ed)).toBe('Typed.')
  ed.view.dispatch(ed.state.tr.setMeta(phantomKey, ''))
  expect(ed.view.dom.querySelector('.phantom')).toBeNull()
})

const items = () => suggestionsKey.getState(ed.state)!.items

it('suggested headings land on the anchored blocks even after edits above them, and are never saved', () => {
  make('# Title\n\nOne.\n\nTwo.\n\nThree.')
  expect(headingBlocks(ed.state.doc).map((b) => b.type)).toEqual(['h1', 'p', 'p', 'p'])
  ed.view.dispatch(anchorTr(ed.state))
  ed.commands.insertContentAt(ed.state.doc.child(0).nodeSize + 1, 'Typed meanwhile. ') // into "One." while waiting
  ed.view.dispatch(suggestTr(ed.state, [{ before: 2, level: 2, text: 'Part two' }, { before: 3, level: 3, text: 'Detail' }]))
  expect(items().map((i) => i.text)).toEqual(['Part two', 'Detail'])
  expect(ed.view.dom.querySelectorAll('.suggested-heading h2, .suggested-heading h3').length).toBe(2)
  expect(getMarkdown(ed)).toBe('# Title\n\nTyped meanwhile. One.\n\nTwo.\n\nThree.')
  ed.view.dispatch(keepTr(ed.state, [items()[0].id]))
  expect(getMarkdown(ed)).toBe('# Title\n\nTyped meanwhile. One.\n\n## Part two\n\nTwo.\n\nThree.')
  expect(items().map((i) => i.text)).toEqual(['Detail'])
  ed.view.dispatch(dropTr(ed.state))
  expect(items()).toEqual([])
  expect(ed.view.dom.querySelector('.suggested-heading')).toBeNull()
})

it('keep all inserts every heading; a suggestion goes when its block is deleted', () => {
  make('Intro.\n\nA.\n\nB.\n\nC.')
  ed.view.dispatch(anchorTr(ed.state))
  ed.view.dispatch(suggestTr(ed.state, [{ before: 1, level: 2, text: 'First' }, { before: 2, level: 3, text: 'Gone' }, { before: 3, level: 2, text: 'Last' }]))
  const b = ed.state.doc.child(0).nodeSize + ed.state.doc.child(1).nodeSize
  ed.view.dispatch(ed.state.tr.delete(b, b + ed.state.doc.child(2).nodeSize)) // delete "B."
  expect(items().map((i) => i.text)).toEqual(['First', 'Last'])
  ed.view.dispatch(keepTr(ed.state))
  expect(getMarkdown(ed)).toBe('Intro.\n\n## First\n\nA.\n\n## Last\n\nC.')
  ed.commands.undo() // kept headings are ordinary edits
  expect(getMarkdown(ed)).not.toContain('##')
})

it('curls quotes in dictated and typed text, not in code or loaded docs', () => {
  make('Kept "straight" and `"code"`.')
  insertChunk(ed, 'he said "hi"', 'body', 'a')
  replacePending(ed, 'a', 'He said "it\'s fine" (\'really\').')
  ed.commands.insertContentAt(ed.state.doc.content.size - 1, ' "Typed"')
  expect(getMarkdown(ed)).toBe('Kept "straight" and `"code"`. He said “it’s fine” (‘really’). “Typed”')
})

it('types apostrophe words and dashes one key at a time', () => {
  make('')
  const type = (s: string) => [...s].forEach((c) => ed.view.dispatch(ed.state.tr.insertText(c, ed.state.doc.content.size - 1)))
  type(`'til the '90s, rock 'n' roll -- 'tile' - "ok"`)
  expect(getMarkdown(ed)).toBe('’til the ’90s, rock ’n’ roll — ‘tile’ – “ok”')
})

it('leaves a line of hyphens for the horizontal rule', () => {
  make('')
  ed.view.dispatch(ed.state.tr.insertText('---', 1))
  expect(ed.getText()).toBe('---')
})
