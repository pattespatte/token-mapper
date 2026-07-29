import { describe, expect, it } from 'vitest'
import { pathToDisplayName } from '@/utils/name'

/**
 * Display-name derivation tests. The heuristic: strip a trailing type segment
 * (shadow/color/font/...), take the last two remaining segments, title-case.
 * Never invents words — `md` stays `Md`.
 */

describe('pathToDisplayName', () => {
  it('drops a trailing type segment and title-cases the last two', () => {
    expect(pathToDisplayName('f.box.modal.shadow')).toBe('Box modal')
    expect(pathToDisplayName('color.accent.primary')).toBe('Accent primary')
  })

  it('keeps the last segment when only one remains after stripping the type', () => {
    expect(pathToDisplayName('shadow.md')).toBe('Md')
    expect(pathToDisplayName('shadow.focus-ring')).toBe('Focus ring')
  })

  it('handles a single-segment path that is the type itself', () => {
    // `shadow` alone — stripping would empty the list, so it's kept as-is.
    expect(pathToDisplayName('shadow')).toBe('Shadow')
    expect(pathToDisplayName('color')).toBe('Color')
  })

  it('handles a single-segment path that is not a type', () => {
    expect(pathToDisplayName('radius')).toBe('Radius')
    expect(pathToDisplayName('foo')).toBe('Foo')
  })

  it('splits hyphenated segments into title-cased words', () => {
    expect(pathToDisplayName('shadow.focus-ring')).toBe('Focus ring')
    expect(pathToDisplayName('color.brand-coral.primary')).toBe('Brand coral primary')
  })

  it('handles multi-segment paths by taking the last two after stripping', () => {
    expect(pathToDisplayName('a.b.c.d.shadow')).toBe('C d')
  })

  it('returns empty string for empty or non-string input', () => {
    expect(pathToDisplayName('')).toBe('')
    expect(pathToDisplayName(42 as unknown as string)).toBe('')
  })

  it('does not invent words (md stays Md, not Medium)', () => {
    expect(pathToDisplayName('shadow.md')).toBe('Md')
    expect(pathToDisplayName('spacing.xl')).toBe('Xl')
  })
})
