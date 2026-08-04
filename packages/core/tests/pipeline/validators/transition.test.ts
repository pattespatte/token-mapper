import { describe, expect, it } from 'vitest'
import { validateTransition } from '@/pipeline/validators/transition'
import { makeCtx } from './helpers'

/** transition composite — { duration, delay, timingFunction }. */
describe('validateTransition', () => {
  it('accepts a valid transition object', () => {
    const { reports, ctx } = makeCtx()
    validateTransition(
      { duration: '200ms', delay: '0ms', timingFunction: [0.4, 0, 0.2, 1] },
      ctx
    )
    expect(reports).toEqual([])
  })

  it('reports INVALID_COMPOSITE_FIELD for a non-object', () => {
    const { reports, ctx } = makeCtx()
    validateTransition('200ms', ctx)
    expect(reports[0]?.code).toBe('INVALID_COMPOSITE_FIELD')
  })

  it('reports a bad duration sub-field with INVALID_DURATION', () => {
    const { reports, ctx } = makeCtx('t')
    validateTransition({ duration: 'fast', delay: '0ms' }, ctx)
    expect(reports[0]?.code).toBe('INVALID_DURATION')
    expect(reports[0]?.path).toBe('t.duration')
  })

  it('reports a bad timingFunction sub-field via the cubicBezier validator', () => {
    const { reports, ctx } = makeCtx('t')
    validateTransition(
      { duration: '200ms', delay: '0ms', timingFunction: [0.4, 0, 0.2] },
      ctx
    )
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_CUBIC_BEZIER')
    expect(reports[0]?.path).toBe('t.timingFunction')
  })
})
