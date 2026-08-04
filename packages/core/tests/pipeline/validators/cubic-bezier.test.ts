import { describe, expect, it } from 'vitest'
import { validateCubicBezier } from '@/pipeline/validators/cubicBezier'
import { makeCtx } from './helpers'

/**
 * cubicBezier validator — array of exactly 4 finite numbers, each in [0, 1].
 * Distinct codes for shape (INVALID_CUBIC_BEZIER) vs range
 * (INVALID_CUBIC_BEZIER_RANGE), and the offending element's index appears in
 * the path.
 */
describe('validateCubicBezier', () => {
  it('accepts a valid 4-tuple in range', () => {
    const { reports, ctx } = makeCtx()
    validateCubicBezier([0.4, 0, 0.2, 1], ctx)
    expect(reports).toEqual([])
  })

  it('accepts the boundary values 0 and 1', () => {
    const { reports, ctx } = makeCtx()
    validateCubicBezier([0, 0, 1, 1], ctx)
    expect(reports).toEqual([])
  })

  it('rejects a non-array', () => {
    const { reports, ctx } = makeCtx()
    validateCubicBezier('fast', ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_CUBIC_BEZIER')
  })

  it('rejects an array of the wrong length', () => {
    const { reports: r1, ctx: c1 } = makeCtx()
    validateCubicBezier([0, 0, 1], c1)
    expect(r1[0]?.code).toBe('INVALID_CUBIC_BEZIER')

    const { reports: r2, ctx: c2 } = makeCtx()
    validateCubicBezier([0, 0, 1, 1, 1], c2)
    expect(r2[0]?.code).toBe('INVALID_CUBIC_BEZIER')
  })

  it('reports an out-of-range x-coordinate (indices 0 or 2) with the index in the path', () => {
    // Per spec only x-coords (indices 0 and 2) must be in [0, 1]; y-coords
    // (1 and 3) may be any real number.
    const { reports, ctx } = makeCtx('token')
    validateCubicBezier([0.4, 1.5, 1.2, 1], ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_CUBIC_BEZIER_RANGE')
    expect(reports[0]?.path).toBe('token[2]')
  })

  it('accepts y-coordinates (indices 1 and 3) outside [0, 1]', () => {
    // An overshooting ease-out-back with y2 = 1.5 is spec-valid.
    const { reports, ctx } = makeCtx()
    validateCubicBezier([0.4, -0.2, 0.2, 1.5], ctx)
    expect(reports).toEqual([])
  })

  it('rejects both x-coordinates when both are out of range', () => {
    const { reports, ctx } = makeCtx('token')
    validateCubicBezier([1.5, 0, -0.5, 1], ctx)
    expect(reports).toHaveLength(2)
    expect(reports.map((r) => r.path).sort()).toEqual(['token[0]', 'token[2]'])
    expect(reports.every((r) => r.code === 'INVALID_CUBIC_BEZIER_RANGE')).toBe(true)
  })

  it('reports a non-number element', () => {
    const { reports, ctx } = makeCtx('token')
    validateCubicBezier([0.4, 'fast', 0.2, 1], ctx)
    expect(reports[0]?.code).toBe('INVALID_CUBIC_BEZIER')
    expect(reports[0]?.path).toBe('token[1]')
  })

  it('rejects NaN and Infinity elements', () => {
    const { reports: r1, ctx: c1 } = makeCtx()
    validateCubicBezier([NaN, 0, 1, 1], c1)
    expect(r1[0]?.code).toBe('INVALID_CUBIC_BEZIER')
    const { reports: r2, ctx: c2 } = makeCtx()
    validateCubicBezier([0, 0, Infinity, 1], c2)
    expect(r2[0]?.code).toBe('INVALID_CUBIC_BEZIER')
  })

  it('reports each bad x-coordinate independently (no short-circuit)', () => {
    // All four are 1.5, but only the x-coords (0 and 2) are range-checked;
    // y-coords (1 and 3) accept any value, so only 2 reports.
    const { reports, ctx } = makeCtx()
    validateCubicBezier([1.5, 1.5, 1.5, 1.5], ctx)
    expect(reports).toHaveLength(2)
    expect(reports.every((r) => r.code === 'INVALID_CUBIC_BEZIER_RANGE')).toBe(true)
  })
})
