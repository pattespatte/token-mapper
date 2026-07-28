import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  inferType,
  isValidColor,
  isValidDimension,
  isValidFontFamily,
  isValidFontWeight,
  isValidNumber,
  isValidShadow,
  isValidDuration,
} from '@/utils/cssTypeInference'

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

  it('accepts modern length units (lh, cap, ic, viewport, container)', () => {
    expect(isValidDimension('4lh')).toBe(true)
    expect(isValidDimension('0.5cap')).toBe(true)
    expect(isValidDimension('2ic')).toBe(true)
    expect(isValidDimension('1rlh')).toBe(true)
    expect(isValidDimension('100dvh')).toBe(true)
    expect(isValidDimension('50svh')).toBe(true)
    expect(isValidDimension('50lvw')).toBe(true)
    expect(isValidDimension('10cqi')).toBe(true)
    expect(isValidDimension('3cqmin')).toBe(true)
    expect(isValidDimension('2cqb')).toBe(true)
  })

  it('accepts negative and signed lengths with any unit', () => {
    expect(isValidDimension('-0.3px')).toBe(true)
    expect(isValidDimension('-2rem')).toBe(true)
    expect(isValidDimension('+1.5em')).toBe(true)
    expect(isValidDimension('-4lh')).toBe(true)
  })

  it('rejects non-strings', () => {
    expect(isValidDimension(16)).toBe(false)
    expect(isValidDimension(null)).toBe(false)
  })

  it('rejects values without units (except bare 0)', () => {
    expect(isValidDimension('16')).toBe(false)
    expect(isValidDimension('garbage')).toBe(false)
  })

  it('rejects unknown units and malformed lengths', () => {
    expect(isValidDimension('4zz')).toBe(false)
    expect(isValidDimension('lh')).toBe(false) // no number
    expect(isValidDimension('--5px')).toBe(false) // double sign
    expect(isValidDimension('5px ')).toBe(false) // trailing space (anchored)
  })
})

describe('isValidFontFamily', () => {
  it('accepts quoted font stacks with a generic terminator', () => {
    expect(isValidFontFamily('"ExpFont", "NeueHass", sans-serif')).toBe(true)
    expect(isValidFontFamily("'Inter', sans-serif")).toBe(true)
    expect(isValidFontFamily('"Consolas", "Liberation Mono", monospace')).toBe(true)
  })

  it('accepts a bare generic-family keyword', () => {
    expect(isValidFontFamily('monospace')).toBe(true)
    expect(isValidFontFamily('system-ui')).toBe(true)
    expect(isValidFontFamily('sans-serif')).toBe(true)
  })

  it('accepts a quoted name alone', () => {
    expect(isValidFontFamily('"My Custom Font"')).toBe(true)
  })

  it('rejects bare unquoted names (too ambiguous)', () => {
    expect(isValidFontFamily('Arial')).toBe(false)
    expect(isValidFontFamily('Helvetica')).toBe(false)
  })

  it('rejects non-font values', () => {
    expect(isValidFontFamily('#fff')).toBe(false)
    expect(isValidFontFamily('16px')).toBe(false)
    expect(isValidFontFamily('sans-serif, bold')).toBe(false) // not a stack terminator
    expect(isValidFontFamily(42)).toBe(false)
    expect(isValidFontFamily(null)).toBe(false)
  })
})

describe('isValidFontWeight', () => {
  it('accepts bare integers in the 1–1000 range', () => {
    expect(isValidFontWeight('100')).toBe(true)
    expect(isValidFontWeight('400')).toBe(true)
    expect(isValidFontWeight('700')).toBe(true)
    expect(isValidFontWeight('900')).toBe(true)
    expect(isValidFontWeight('1000')).toBe(true)
    expect(isValidFontWeight('350')).toBe(true) // spec allows any integer
  })

  it('accepts the keyword weights', () => {
    expect(isValidFontWeight('normal')).toBe(true)
    expect(isValidFontWeight('bold')).toBe(true)
    expect(isValidFontWeight('lighter')).toBe(true)
    expect(isValidFontWeight('bolder')).toBe(true)
  })

  it('rejects out-of-range and malformed values', () => {
    expect(isValidFontWeight('0')).toBe(false)
    expect(isValidFontWeight('1001')).toBe(false)
    expect(isValidFontWeight('4.5')).toBe(false) // weights are integers
    expect(isValidFontWeight('bolditalic')).toBe(false)
    expect(isValidFontWeight('#fff')).toBe(false)
    expect(isValidFontWeight(400)).toBe(false) // non-string
  })
})

describe('isValidNumber', () => {
  it('accepts bare integers and decimals with optional sign', () => {
    expect(isValidNumber('2')).toBe(true)
    expect(isValidNumber('-1')).toBe(true)
    expect(isValidNumber('+3')).toBe(true)
    expect(isValidNumber('1.5')).toBe(true)
    expect(isValidNumber('0.8')).toBe(true)
    expect(isValidNumber('-0.25')).toBe(true)
  })

  it('accepts scientific notation', () => {
    expect(isValidNumber('1e3')).toBe(true)
    expect(isValidNumber('1.5e-2')).toBe(true)
  })

  it('rejects values with units or non-numeric content', () => {
    expect(isValidNumber('16px')).toBe(false)
    expect(isValidNumber('400ms')).toBe(false)
    expect(isValidNumber('')).toBe(false)
    expect(isValidNumber('1.2.3')).toBe(false)
    expect(isValidNumber(2)).toBe(false) // non-string
  })
})

describe('isValidShadow', () => {
  it('accepts a basic two-offset shadow', () => {
    expect(isValidShadow('2px 2px')).toBe(true)
    expect(isValidShadow('0 0')).toBe(true)
  })

  it('accepts a full offset/blur/spread/color shadow', () => {
    expect(isValidShadow('0 0 20px rgba(0,0,0,0.3)')).toBe(true)
    expect(isValidShadow('0 1px 3px #000')).toBe(true)
    expect(isValidShadow('0 0 5px 2px red')).toBe(true)
  })

  it('accepts an inset shadow', () => {
    expect(isValidShadow('inset 0 2px 3px rgba(0,0,0,0.1)')).toBe(true)
    expect(isValidShadow('inset 2px 2px')).toBe(true)
  })

  it('accepts modern length units in shadow tokens', () => {
    expect(isValidShadow('0 0 4lh rgba(0,0,0,0.2)')).toBe(true)
    expect(isValidShadow('0 0 2cqh black')).toBe(true)
  })

  it('rejects multi-layer (comma-separated) shadows', () => {
    expect(isValidShadow('0 0 1px red, 0 0 2px blue')).toBe(false)
  })

  it('rejects a single length (that is a dimension, not a shadow)', () => {
    expect(isValidShadow('16px')).toBe(false)
    expect(isValidShadow('0')).toBe(false)
  })

  it('rejects non-shadow and non-string values', () => {
    expect(isValidShadow('red')).toBe(false) // color, not shadow
    expect(isValidShadow('hello world')).toBe(false)
    expect(isValidShadow(42)).toBe(false)
  })
})

describe('isValidDuration', () => {
  it('accepts ms and s values, including fractional and signed', () => {
    expect(isValidDuration('400ms')).toBe(true)
    expect(isValidDuration('0.3s')).toBe(true)
    expect(isValidDuration('2s')).toBe(true)
    expect(isValidDuration('-100ms')).toBe(true)
    expect(isValidDuration('+5s')).toBe(true)
  })

  it('rejects bare numbers and composite transitions', () => {
    expect(isValidDuration('400')).toBe(false) // no unit
    expect(isValidDuration('400mss')).toBe(false) // bad unit
    expect(isValidDuration('all 400ms')).toBe(false) // composite
    expect(isValidDuration('400ms ease')).toBe(false) // composite
    expect(isValidDuration(400)).toBe(false) // non-string
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
    expect(inferType('4lh')).toBe('dimension') // modern unit
  })

  it('returns "fontFamily" for font stacks', () => {
    expect(inferType('"Inter", sans-serif')).toBe('fontFamily')
    expect(inferType('monospace')).toBe('fontFamily')
  })

  it('returns "fontWeight" for weight values', () => {
    expect(inferType('400')).toBe('fontWeight')
    expect(inferType('bold')).toBe('fontWeight')
  })

  it('returns "number" for residual bare numerics (decimals are never weights)', () => {
    // Note: bare integers 1–1000 resolve to fontWeight (checked earlier in the
    // cascade). Decimals can never be weights, so they fall through to number.
    expect(inferType('1.5')).toBe('number')
    expect(inferType('-0.25')).toBe('number')
    expect(inferType('0.8')).toBe('number')
    expect(inferType('2e3')).toBe('number')
  })

  it('returns "shadow" for box-shadow shapes', () => {
    expect(inferType('0 0 20px rgba(0,0,0,0.3)')).toBe('shadow')
    expect(inferType('inset 2px 2px')).toBe('shadow')
  })

  it('returns "duration" for time values', () => {
    expect(inferType('400ms')).toBe('duration')
    expect(inferType('0.3s')).toBe('duration')
  })

  it('returns undefined for genuinely unknown shapes', () => {
    expect(inferType('garbage')).toBeUndefined()
    expect(inferType('Arial')).toBeUndefined() // bare unquoted name — ambiguous
    expect(inferType('all 400ms ease')).toBeUndefined() // composite transition
    expect(inferType('0 auto 3rem auto')).toBeUndefined() // shorthand
    expect(inferType(42)).toBeUndefined()
  })

  it('resolves overlapping shapes by cascade order (order matters)', () => {
    // Color is checked first — '#000' is unambiguously a color, not a dimension.
    expect(inferType('#000')).toBe('color')
    // font-weight (400) is checked before number, so 400 → fontWeight not number.
    expect(inferType('400')).toBe('fontWeight')
    // A bare 2 is not a valid font-weight (1–1000 range? yes) — but the cascade
    // checks fontWeight first, and 2 IS in 1–1000, so it resolves as a weight.
    // Document this explicitly: bare integers in 1–1000 are weights.
    expect(inferType('2')).toBe('fontWeight')
    // A decimal like 1.5 is not a valid integer weight → falls through to number.
    expect(inferType('1.5')).toBe('number')
    // A lone length is a dimension, not a one-element shadow (shadow is after).
    expect(inferType('16px')).toBe('dimension')
  })
})
