import { describe, expect, it } from 'vitest'
import { validateGradient } from '@/pipeline/validators/gradient'
import { makeCtx } from './helpers'

/**
 * gradient validator — non-empty array of stops, each { color, position }
 * with position in [0, 1]. Reports INVALID_GRADIENT for shape failures,
 * delegates color/position to their primitive validators.
 */
describe('validateGradient', () => {
  it('accepts a well-formed two-stop gradient', () => {
    const { reports, ctx } = makeCtx()
    validateGradient(
      [
        { color: '#ff0000', position: 0 },
        { color: '#0000ff', position: 1 },
      ],
      ctx
    )
    expect(reports).toEqual([])
  })

  it('rejects a non-array', () => {
    const { reports, ctx } = makeCtx()
    validateGradient({ color: '#fff', position: 0 }, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_GRADIENT')
  })

  it('rejects an empty array', () => {
    const { reports, ctx } = makeCtx()
    validateGradient([], ctx)
    expect(reports[0]?.code).toBe('INVALID_GRADIENT')
    expect(reports[0]?.message).toMatch(/no stops/)
  })

  it('reports a stop with an out-of-range position', () => {
    const { reports, ctx } = makeCtx('token')
    validateGradient([{ color: '#fff', position: 1.5 }], ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_GRADIENT')
    expect(reports[0]?.path).toBe('token[0].position')
  })

  it('reports a stop with an invalid color via the color validator', () => {
    const { reports, ctx } = makeCtx('token')
    validateGradient([{ color: 'notacolor', position: 0.5 }], ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
    expect(reports[0]?.path).toBe('token[0].color')
  })

  it('reports a stop missing color', () => {
    const { reports, ctx } = makeCtx('token')
    validateGradient([{ position: 0.5 }], ctx)
    expect(reports[0]?.code).toBe('INVALID_GRADIENT')
    expect(reports[0]?.message).toMatch(/missing "color"/)
  })

  it('reports a stop missing position', () => {
    const { reports, ctx } = makeCtx('token')
    validateGradient([{ color: '#fff' }], ctx)
    expect(reports[0]?.code).toBe('INVALID_GRADIENT')
    expect(reports[0]?.message).toMatch(/missing "position"/)
  })
})
