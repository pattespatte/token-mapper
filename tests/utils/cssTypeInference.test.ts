import { describe, expect, it, vi, afterEach } from 'vitest'
import { inferType, isValidColor, isValidDimension } from '@/utils/cssTypeInference'

/**
 * CSS type-inference tests. The two boolean checks are extracted verbatim
 * from the validator, so these tests also serve as a regression guard for
 * the extraction. The `isValidColor` path uses the browser's `CSS.supports`
 * when available — jsdom doesn't implement it, so we mock it for the cases
 * that need it. Hex and dimension paths need no mock.
 */

describe('isValidColor', () => {
  it('accepts 3/6/8-digit hex', () => {
    expect(isValidColor('#abc')).toBe(true)
    expect(isValidColor('#aabbcc')).toBe(true)
    expect(isValidColor('#aabbccff')).toBe(true)
  })

  it('accepts structured W3C color object', () => {
    expect(isValidColor({ colorSpace: 'srgb', components: [1, 0, 0] })).toBe(true)
  })

  it('rejects non-color objects', () => {
    expect(isValidColor({ foo: 'bar' })).toBe(false)
    expect(isValidColor([1, 2, 3])).toBe(false)
  })

  it('rejects non-string non-object values', () => {
    expect(isValidColor(42)).toBe(false)
    expect(isValidColor(null)).toBe(false)
    expect(isValidColor(true)).toBe(false)
  })

  it('uses CSS.supports when available (browser path)', () => {
    const fakeSupports = vi.fn<(prop: string, value: string) => boolean>()
    fakeSupports.mockImplementation((_prop, value) => value === 'rgb(255, 0, 0)')
    vi.stubGlobal('CSS', { supports: fakeSupports })
    expect(isValidColor('rgb(255, 0, 0)')).toBe(true)
    expect(isValidColor('rgb(1, 2, 3)')).toBe(false)
    expect(fakeSupports).toHaveBeenCalledWith('color', 'rgb(255, 0, 0)')
    vi.unstubAllGlobals()
  })

  it('falls back to regex when CSS.supports is unavailable (Node path)', () => {
    // Hide CSS global to simulate Node.
    vi.stubGlobal('CSS', undefined)
    expect(isValidColor('rgb(255, 0, 0)')).toBe(true) // matches /[a-z]+\(\s*[^)]*\d[^)]*\s*\)/i
    expect(isValidColor('rgb()')).toBe(false) // no digit inside
    expect(isValidColor('not-a-color')).toBe(false)
    vi.unstubAllGlobals()
  })
})

describe('isValidDimension', () => {
  it('accepts common length units', () => {
    expect(isValidDimension('16px')).toBe(true)
    expect(isValidDimension('1rem')).toBe(true)
    expect(isValidDimension('2em')).toBe(true)
    expect(isValidDimension('100%')).toBe(true)
    expect(isValidDimension('50vw')).toBe(true)
    expect(isValidDimension('10pt')).toBe(true)
  })

  it('accepts bare 0 (unitless length)', () => {
    expect(isValidDimension('0')).toBe(true)
    expect(isValidDimension('+0')).toBe(true)
    expect(isValidDimension('-0.0')).toBe(true)
  })

  it('accepts signed and decimal values', () => {
    expect(isValidDimension('-4px')).toBe(true)
    expect(isValidDimension('+4px')).toBe(true)
    expect(isValidDimension('0.5rem')).toBe(true)
  })

  it('rejects non-strings', () => {
    expect(isValidDimension(16)).toBe(false)
    expect(isValidDimension(null)).toBe(false)
  })

  it('rejects values without units (except bare 0)', () => {
    expect(isValidDimension('16')).toBe(false)
    expect(isValidDimension('garbage')).toBe(false)
  })
})

describe('inferType', () => {
  it('returns "color" for color shapes', () => {
    expect(inferType('#ff0000')).toBe('color')
    expect(inferType('#abc')).toBe('color')
  })

  it('returns "dimension" for length shapes', () => {
    expect(inferType('16px')).toBe('dimension')
    expect(inferType('1rem')).toBe('dimension')
    expect(inferType('0')).toBe('dimension')
  })

  it('returns undefined for unknown shapes', () => {
    expect(inferType('garbage')).toBeUndefined()
    expect(inferType('Inter')).toBeUndefined() // fontFamily — not inferred this batch
    expect(inferType('200ms')).toBeUndefined() // duration — not inferred this batch
    expect(inferType(42)).toBeUndefined()
  })

  it('checks color before dimension (order matters)', () => {
    // A value like '#000' is unambiguously a color, not a dimension.
    expect(inferType('#000')).toBe('color')
  })
})
