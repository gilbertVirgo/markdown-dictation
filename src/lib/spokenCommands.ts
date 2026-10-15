// Fallback for when Claude refine is off (and used to pre-render breaks in pending text).
const RULES: [RegExp, string][] = [
  [/\s*\b(?:new paragraph|paragraph break)\b[\s,.]*/gi, '\n\n'],
  [/\s*\b(?:new line|newline|line break|carriage return)\b[\s,.]*/gi, '\n'],
  [/(^|\n)[ \t]*\b(?:bullet point|bullet)\b\s*/gi, '$1- '],
  [/\s*\bfull stop\b/gi, '.'],
  [/\s*\bcomma\b/gi, ','],
  [/\s*\bquestion mark\b/gi, '?'],
  [/\s*\b(?:exclamation mark|exclamation point)\b/gi, '!'],
]

export function applySpokenCommands(raw: string): string {
  let s = raw
  for (const [re, to] of RULES) s = s.replace(re, to)
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim()
}
