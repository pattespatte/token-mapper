import { describe, expect, it } from 'vitest'
import { weightKeywordToNumber, primaryFontFamily } from '@/utils/font'

/**
 * Font helper tests. Two pure functions: the weight keyword→numeric map
 * (normal/bold absolute; lighter/bolder relative → null) and the primary
 * family extractor (first comma entry, quotes stripped).
 */

describe('weightKeywordToNumber', () => {
  it('maps normal → 400', () => {
    expect(weightKeywordToNumber('normal')).toBe(400)
  })

  it('maps bold → 700', () => {
    expect(weightKeywordToNumber('bold')).toBe(700)
  })

  it('is case-insensitive', () => {
    expect(weightKeywordToNumber('NORMAL')).toBe(400)
    expect(weightKeywordToNumber('Bold')).toBe(700)
  })

  it('trims surrounding whitespace', () => {
    expect(weightKeywordToNumber('  normal  ')).toBe(400)
  })

  it('returns null for the relative keywords (lighter/bolder)', () => {
    // These depend on the inherited parent weight; no fixed number exists.
    expect(weightKeywordToNumber('lighter')).toBeNull()
    expect(weightKeywordToNumber('bolder')).toBeNull()
  })

  it('returns null for numeric strings (already a number, not a keyword)', () => {
    expect(weightKeywordToNumber('400')).toBeNull()
    expect(weightKeywordToNumber('700')).toBeNull()
  })

  it('returns null for non-keyword and non-string values', () => {
    expect(weightKeywordToNumber('garbage')).toBeNull()
    expect(weightKeywordToNumber('')).toBeNull()
    expect(weightKeywordToNumber(400 as unknown as string)).toBeNull()
  })
})

describe('primaryFontFamily', () => {
  it('extracts the first quoted family from a stack', () => {
    expect(primaryFontFamily('"Inter Variable", sans-serif')).toBe('Inter Variable')
    expect(primaryFontFamily('"Consolas", "Courier", monospace')).toBe('Consolas')
  })

  it('extracts the first single-quoted family', () => {
    expect(primaryFontFamily("'Inter', sans-serif")).toBe('Inter')
  })

  it('returns the bare generic family when the stack is just a keyword', () => {
    expect(primaryFontFamily('monospace')).toBe('monospace')
    expect(primaryFontFamily('system-ui')).toBe('system-ui')
  })

  it('returns the bare unquoted family name as-is', () => {
    expect(primaryFontFamily('Arial, sans-serif')).toBe('Arial')
  })

  it('preserves internal spaces in a quoted name', () => {
    expect(primaryFontFamily('"My Custom Font", sans-serif')).toBe('My Custom Font')
  })

  it('trims surrounding whitespace from the input and the result', () => {
    expect(primaryFontFamily('  "Inter", sans-serif  ')).toBe('Inter')
    expect(primaryFontFamily('  "  Spaced  ", sans-serif')).toBe('Spaced')
  })

  it('returns empty string for empty or non-string input', () => {
    expect(primaryFontFamily('')).toBe('')
    expect(primaryFontFamily('   ')).toBe('')
    expect(primaryFontFamily(42 as unknown as string)).toBe('')
  })

  it('returns empty string when the first entry is empty after stripping', () => {
    expect(primaryFontFamily(', sans-serif')).toBe('')
  })
})
