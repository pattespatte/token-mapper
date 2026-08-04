import { describe, expect, it } from 'vitest'
import { validateColor } from '@/pipeline/validators/color'
import { validateDimension } from '@/pipeline/validators/dimension'
import { validateFontFamily } from '@/pipeline/validators/fontFamily'
import { makeCtx } from './helpers'

/**
 * Direct tests for the color, dimension, and fontFamily primitive validators.
 * color/dimension wrap the shared cssTypeInference helpers; fontFamily is a
 * DTCG-shape check (string | string[]). Each reports INVALID_VALUE_FOR_TYPE
 * on mismatch.
 */
describe('validateColor', () => {
  it('accepts hex and rgb() forms', () => {
    // Named colors (e.g. 'red') are intentionally not asserted here: their
    // validity depends on CSS.supports(), which jsdom does not fully implement.
    // The cssTypeInference tests cover the browser/Node fallback paths.
    for (const v of ['#fff', '#ff0000', '#0a0d120d', 'rgb(0, 0, 0)']) {
      const { reports, ctx } = makeCtx()
      validateColor(v, ctx)
      expect(reports, `${v} should be valid`).toEqual([])
    }
  })

  it('rejects a non-color value', () => {
    const { reports, ctx } = makeCtx('token')
    validateColor(42, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
  })
})

describe('validateDimension', () => {
  it('accepts lengths with modern and classic units', () => {
    for (const v of ['16px', '1.5rem', '-0.3em', '2dvh', '100%']) {
      const { reports, ctx } = makeCtx()
      validateDimension(v, ctx)
      expect(reports, `${v} should be valid`).toEqual([])
    }
  })

  it('rejects a unitless number string', () => {
    const { reports, ctx } = makeCtx()
    validateDimension('16', ctx)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
  })

  it('rejects a non-string', () => {
    const { reports, ctx } = makeCtx()
    validateDimension(16, ctx)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
  })
})

describe('validateFontFamily', () => {
  it('accepts any non-empty string', () => {
    const { reports, ctx } = makeCtx()
    validateFontFamily('Arial', ctx)
    expect(reports).toEqual([])
  })

  it('accepts an array of non-empty strings', () => {
    const { reports, ctx } = makeCtx()
    validateFontFamily(['Inter', 'sans-serif'], ctx)
    expect(reports).toEqual([])
  })

  it('rejects an empty string', () => {
    const { reports, ctx } = makeCtx()
    validateFontFamily('', ctx)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
  })

  it('rejects an array containing a non-string', () => {
    const { reports, ctx } = makeCtx()
    validateFontFamily(['Inter', 42], ctx)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
  })

  it('rejects a number', () => {
    const { reports, ctx } = makeCtx()
    validateFontFamily(42, ctx)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
  })
})
