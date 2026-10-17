import { expect, it } from 'vitest'
import { buildHeadingsUser, validSuggestions, type HeadingBlock } from '../../src/lib/headingsPrompt'

const p = (n: number): HeadingBlock => ({ type: 'p', text: 'word '.repeat(n).trim() })
const s = (before: number, text = `At ${before}`, level = 2) => ({ before, level, text })

it('numbers blocks with their type', () => {
  expect(buildHeadingsUser([{ type: 'h1', text: 'Title' }, p(1)])).toBe('<document>\n[0] (h1) Title\n[1] (p) word\n</document>')
})

it('drops unplaceable suggestions', () => {
  const blocks: HeadingBlock[] = [{ type: 'h1', text: 'Title' }, p(130), p(130), { type: 'blank', text: '' }, p(130), { type: 'h2', text: 'Old' }, p(130), p(130)]
  expect(validSuggestions({ headings: [
    s(2, ' Second part. '), // trimmed, trailing punctuation dropped
    s(2, 'Same block again'),
    s(1, 'Right under the H1'),
    s(3, 'Above a blank'),
    s(5, 'Above a heading'),
    s(6, 'Right under a heading'),
    s(4, 'H1 not allowed', 1),
    s(9, 'Out of range'),
    s(7, ''),
    s(7, 'Sub point', 3),
  ] }, blocks)).toEqual([s(2, 'Second part'), s(7, 'Sub point', 3)])
  expect(validSuggestions({ nope: 1 }, blocks)).toEqual([])
})

it('every section keeps at least 120 words, measured from the last kept heading', () => {
  // 60-word paragraphs: two make a section
  const blocks = [{ type: 'h1', text: 'Title' } as HeadingBlock, ...Array.from({ length: 8 }, () => p(60))]
  expect(validSuggestions({ headings: [s(2), s(3), s(4), s(6), s(8)] }, blocks).map((x) => x.before))
    .toEqual([3, 6]) // 2: only 60 above; 4: 60 since 3; 8: only 60 below
  expect(validSuggestions({ headings: [s(4, 'x', 3), s(3, 'y')] }, blocks).map((x) => x.before)).toEqual([3]) // checked top to bottom
  expect(validSuggestions({ headings: [s(1)] }, [p(200), p(100)])).toEqual([]) // short last section
})
