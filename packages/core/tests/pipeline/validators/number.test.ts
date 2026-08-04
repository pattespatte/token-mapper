import { describe, expect, it } from 'vitest'
import { validateNumber } from '@/pipeline/validators/number'
import { makeCtx } from './helpers'

/** number validator — finite JSON number; NaN and Infinity are rejected. */
describe('validateNumber', () => {
  it('accepts finite numbers', () => {
    for (const v of [0, 42, -1.5, 1000, 0.0001]) {
      const { reports, ctx } = makeCtx()
      validateNumber(v, ctx)
      expect(reports, `${v} should be valid`).toEqual([])
    }
  })

  it('rejects NaN', () => {
    const { reports, ctx } = makeCtx()
    validateNumber(NaN, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_NUMBER')
  })

  it('rejects Infinity and -Infinity', () => {
    const { reports: r1, ctx: c1 } = makeCtx()
    validateNumber(Infinity, c1)
    expect(r1[0]?.code).toBe('INVALID_NUMBER')
    const { reports: r2, ctx: c2 } = makeCtx()
    validateNumber(-Infinity, c2)
    expect(r2[0]?.code).toBe('INVALID_NUMBER')
  })

  it('rejects a non-number', () => {
    const { reports, ctx } = makeCtx()
    validateNumber('42', ctx)
    expect(reports[0]?.code).toBe('INVALID_NUMBER')
  })
})
