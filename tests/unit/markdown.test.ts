import { describe, expect, it } from 'vitest'
import { deriveTitle, extractVocabulary } from '../../src/lib/markdown'

describe('deriveTitle', () => {
  it('uses h1', () => expect(deriveTitle('intro\n# My Title\nbody')).toBe('My Title'))
  it('uses first line stripped of markers', () => expect(deriveTitle('\n\n> **Hello** world')).toBe('Hello world'))
  it('defaults', () => expect(deriveTitle('  \n')).toBe('Untitled'))
  it('caps at 80', () => expect(deriveTitle('# ' + 'a'.repeat(100))).toHaveLength(80))
})

describe('extractVocabulary', () => {
  it('picks names, skips sentence starts', () => {
    const v = extractVocabulary('The book of Nehemiah is long. Then Ezra came. We read it.')
    expect(v).toContain('Nehemiah')
    expect(v).toContain('Ezra')
    expect(v).not.toContain('The')
    expect(v).not.toContain('Then')
  })
  it('apostrophe, hyphen, non-ascii; min length', () => {
    const v = extractVocabulary("# Title\n- don't over-think café the Joe")
    expect(v).toEqual(expect.arrayContaining(["don't", 'over-think', 'café']))
    expect(v).not.toContain('Joe')
  })
  it('dedupes and caps', () => {
    expect(extractVocabulary('a Nehemiah Nehemiah Jerusalem', 2)).toEqual(['Nehemiah', 'Jerusalem'])
  })
})
