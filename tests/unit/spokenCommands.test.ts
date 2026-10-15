import { describe, expect, it } from 'vitest'
import { applySpokenCommands as f } from '../../src/lib/spokenCommands'

describe('applySpokenCommands', () => {
  it('new line', () => expect(f('hello new line world')).toBe('hello\nworld'))
  it('newline / line break', () => {
    expect(f('a Newline b')).toBe('a\nb')
    expect(f('a line break b')).toBe('a\nb')
  })
  it('carriage return', () => expect(f('one carriage return two')).toBe('one\ntwo'))
  it('new paragraph', () => expect(f('end of thought new paragraph next')).toBe('end of thought\n\nnext'))
  it('punctuation spacing', () => expect(f('well comma yes full stop really question mark')).toBe('well, yes. really?'))
  it('bullet at start and after newline', () => expect(f('bullet point one new line bullet point two')).toBe('- one\n- two'))
  it('leaves words containing commands alone', () => {
    expect(f('the commander said colonel')).toBe('the commander said colonel')
    expect(f('a periodic table')).toBe('a periodic table')
    expect(f('the period of time')).toBe('the period of time')
  })
  it('trims spaces but keeps edge newlines', () => expect(f('  hi new line  ')).toBe('hi\n'))
  it('lone command is a break', () => {
    expect(f('new line')).toBe('\n')
    expect(f('new line break')).toBe('\n')
    expect(f('new paragraph')).toBe('\n\n')
  })
  it('bare bullet is a word', () => expect(f('bullet train')).toBe('bullet train'))
})
