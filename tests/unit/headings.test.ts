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

it('H2 sections keep 100 words each side, H3 sections 60; H2s are placed first', () => {
  // 50-word paragraphs: an H2 or H3 section needs two
  const blocks = [{ type: 'h1', text: 'Title' } as HeadingBlock, ...Array.from({ length: 8 }, () => p(50))]
  expect(validSuggestions({ headings: [s(2), s(3), s(5), s(7)] }, blocks).map((x) => x.before))
    .toEqual([3, 5, 7]) // 2: only 50 above; 3 placed; 5: 100 since 3; 7: 100 since 5 and 100 below
  expect(validSuggestions({ headings: [s(2, 'x', 3), s(3), s(5, 'y', 3)] }, blocks).map((x) => [x.before, x.level]))
    .toEqual([[3, 2], [5, 3]]) // the H3 at 2 is too close to the H1; the H3 at 5 fits 100 words after the H2 at 3
  const short = [{ type: 'h1', text: 'Title' } as HeadingBlock, p(70), p(70), p(70)]
  expect(validSuggestions({ headings: [s(2, 'x', 3), s(3, 'y', 3)] }, short).map((x) => x.before)).toEqual([2, 3]) // 70 words each side is enough for H3s
  expect(validSuggestions({ headings: [s(1)] }, [p(200), p(90)])).toEqual([]) // short last section for an H2
  expect(validSuggestions({ headings: [s(1, 'z', 3)] }, [p(200), p(90)]).length).toBe(1) // fine for an H3
})
