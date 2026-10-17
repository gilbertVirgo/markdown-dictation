import { expect, it } from 'vitest'
import { buildHeadingsUser, validSuggestions, type HeadingBlock } from '../../src/lib/headingsPrompt'

const blocks: HeadingBlock[] = [
  { type: 'h1', text: 'Title' },
  { type: 'p', text: 'Intro' },
  { type: 'p', text: 'More' },
  { type: 'blank', text: '' },
  { type: 'p', text: 'Next topic' },
  { type: 'h2', text: 'Existing' },
  { type: 'p', text: 'Under existing' },
]

it('numbers blocks with their type', () => {
  expect(buildHeadingsUser(blocks.slice(0, 2))).toBe('<document>\n[0] (h1) Title\n[1] (p) Intro\n</document>')
})

it('keeps placeable H2/H3 suggestions and drops the rest', () => {
  const raw = { headings: [
    { before: 2, level: 2, text: ' Second part. ' }, // trimmed, trailing punctuation dropped
    { before: 2, level: 3, text: 'Duplicate block' },
    { before: 1, level: 2, text: 'Right under the H1' },
    { before: 3, level: 2, text: 'Above a blank' },
    { before: 5, level: 2, text: 'Above a heading' },
    { before: 6, level: 3, text: 'Right under a heading' },
    { before: 4, level: 1, text: 'H1 not allowed' },
    { before: 9, level: 2, text: 'Out of range' },
    { before: 4, level: 3, text: '' },
    { before: 4, level: 3, text: 'Sub point' },
  ] }
  expect(validSuggestions(raw, blocks)).toEqual([
    { before: 2, level: 2, text: 'Second part' },
    { before: 4, level: 3, text: 'Sub point' },
  ])
  expect(validSuggestions({ nope: 1 }, blocks)).toEqual([])
})
