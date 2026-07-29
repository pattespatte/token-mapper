import { describe, expect, it } from 'vitest'
import { parseCssShadow } from '@/utils/shadowParse'

/**
 * CSS box-shadow parser tests. Each case asserts the structured layer shape
 * the ShadowPreview renderer consumes: offsetX/offsetY (required), blur/spread
 * (optional), color (optional), inset (optional boolean).
 */

describe('parseCssShadow', () => {
  it('parses a full single-layer shadow with all fields', () => {
    expect(parseCssShadow('0 4px 6px -1px rgba(17, 24, 39, 0.1)')).toEqual([
      {
        offsetX: '0',
        offsetY: '4px',
        blur: '6px',
        spread: '-1px',
        color: 'rgba(17, 24, 39, 0.1)',
      },
    ])
  })

  it('parses a minimal two-offset shadow with no color', () => {
    expect(parseCssShadow('2px 2px')).toEqual([
      { offsetX: '2px', offsetY: '2px' },
    ])
  })

  it('parses a shadow with blur but no spread', () => {
    expect(parseCssShadow('0 0 20px rgba(0,0,0,0.3)')).toEqual([
      { offsetX: '0', offsetY: '0', blur: '20px', color: 'rgba(0,0,0,0.3)' },
    ])
  })

  it('parses an inset shadow', () => {
    expect(parseCssShadow('inset 0 2px 3px rgba(0,0,0,0.1)')).toEqual([
      {
        offsetX: '0',
        offsetY: '2px',
        blur: '3px',
        color: 'rgba(0,0,0,0.1)',
        inset: true,
      },
    ])
  })

  it('parses a shadow using modern length units (lh, cqh)', () => {
    expect(parseCssShadow('0 0 4lh rgba(0,0,0,0.2)')).toEqual([
      { offsetX: '0', offsetY: '0', blur: '4lh', color: 'rgba(0,0,0,0.2)' },
    ])
    expect(parseCssShadow('0 0 2cqh black')).toEqual([
      { offsetX: '0', offsetY: '0', blur: '2cqh', color: 'black' },
    ])
  })

  it('parses a multi-layer (comma-separated) shadow', () => {
    expect(parseCssShadow('0 0 1px red, 0 0 2px blue')).toEqual([
      { offsetX: '0', offsetY: '0', blur: '1px', color: 'red' },
      { offsetX: '0', offsetY: '0', blur: '2px', color: 'blue' },
    ])
  })

  it('parses a multi-layer shadow mixing inset and non-inset layers', () => {
    expect(
      parseCssShadow('0 1px 3px #000, inset 0 2px 3px rgba(0,0,0,0.1)')
    ).toEqual([
      { offsetX: '0', offsetY: '1px', blur: '3px', color: '#000' },
      {
        offsetX: '0',
        offsetY: '2px',
        blur: '3px',
        color: 'rgba(0,0,0,0.1)',
        inset: true,
      },
    ])
  })

  it('preserves a {…} reference fragment in the color position (resolved later)', () => {
    // The partial-var rewriter turns var(--c) into {c}; the shadow parser must
    // let it through to the color field so the resolver can splice it.
    expect(parseCssShadow('0 0 5px {color.accent}')).toEqual([
      { offsetX: '0', offsetY: '0', blur: '5px', color: '{color.accent}' },
    ])
  })

  it('returns null for a single length (not a shadow)', () => {
    expect(parseCssShadow('16px')).toBeNull()
    expect(parseCssShadow('0')).toBeNull()
  })

  it('returns null for non-shadow strings', () => {
    expect(parseCssShadow('red')).toBeNull()
    expect(parseCssShadow('hello world')).toBeNull()
    expect(parseCssShadow('')).toBeNull()
    expect(parseCssShadow('   ')).toBeNull()
  })

  it('returns null when one layer of a multi-layer value is invalid', () => {
    expect(parseCssShadow('0 0 1px red, not a shadow')).toBeNull()
  })
})
