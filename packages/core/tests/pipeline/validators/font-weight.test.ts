import { describe, expect, it } from 'vitest'
import { validateFontWeight } from '@/pipeline/validators/fontWeight'
import { makeCtx } from './helpers'

/**
 * fontWeight validator — DTCG spec: a number in [1, 1000] OR one of the 18
 * CSS weight keyword aliases. Covers range, aliases, and shape rejection.
 */
describe('validateFontWeight', () => {
  it('accepts numbers in the valid range', () => {
    for (const v of [1, 100, 400, 700, 1000]) {
      const { reports, ctx } = makeCtx()
      validateFontWeight(v, ctx)
      expect(reports, `weight ${v} should be valid`).toEqual([])
    }
  })

  it('rejects numbers below 1', () => {
    const { reports, ctx } = makeCtx('w')
    validateFontWeight(0, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_FONT_WEIGHT')
    expect(reports[0]?.path).toBe('w')
  })

  it('rejects numbers above 1000', () => {
    const { reports, ctx } = makeCtx()
    validateFontWeight(1001, ctx)
    expect(reports[0]?.code).toBe('INVALID_FONT_WEIGHT')
  })

  it('accepts the CSS weight keyword aliases', () => {
    for (const v of ['normal', 'bold', 'light', 'semi-bold', 'black']) {
      const { reports, ctx } = makeCtx()
      validateFontWeight(v, ctx)
      expect(reports, `alias ${v} should be valid`).toEqual([])
    }
  })

  it('rejects an unknown weight string', () => {
    const { reports, ctx } = makeCtx()
    validateFontWeight('bork', ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_FONT_WEIGHT')
    expect(reports[0]?.message).toMatch(/bork/)
  })

  it('rejects a non-number, non-string value', () => {
    const { reports, ctx } = makeCtx()
    validateFontWeight(true, ctx)
    expect(reports[0]?.code).toBe('INVALID_FONT_WEIGHT')
  })

  it('rejects NaN and Infinity', () => {
    const { reports: r1, ctx: c1 } = makeCtx()
    validateFontWeight(NaN, c1)
    expect(r1[0]?.code).toBe('INVALID_FONT_WEIGHT')
    const { reports: r2, ctx: c2 } = makeCtx()
    validateFontWeight(Infinity, c2)
    expect(r2[0]?.code).toBe('INVALID_FONT_WEIGHT')
  })
})
