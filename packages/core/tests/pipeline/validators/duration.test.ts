import { describe, expect, it } from 'vitest'
import { validateDuration } from '@/pipeline/validators/duration'
import { makeCtx } from './helpers'

/**
 * duration validator — DTCG spec: a string of the form `${number}ms`.
 * Stricter than the CSS importer's isValidDuration (which accepts `s` too).
 */
describe('validateDuration', () => {
  it('accepts a number followed by ms', () => {
    for (const v of ['0ms', '200ms', '2.5ms', '1500ms']) {
      const { reports, ctx } = makeCtx()
      validateDuration(v, ctx)
      expect(reports, `${v} should be valid`).toEqual([])
    }
  })

  it('accepts a signed duration', () => {
    const { reports, ctx } = makeCtx()
    validateDuration('-100ms', ctx)
    expect(reports).toEqual([])
  })

  it('rejects a value ending in s (not ms)', () => {
    const { reports, ctx } = makeCtx()
    validateDuration('2s', ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_DURATION')
  })

  it('rejects a bare number', () => {
    const { reports, ctx } = makeCtx()
    validateDuration(200, ctx)
    expect(reports[0]?.code).toBe('INVALID_DURATION')
  })

  it('rejects a bare-number string', () => {
    const { reports, ctx } = makeCtx()
    validateDuration('200', ctx)
    expect(reports[0]?.code).toBe('INVALID_DURATION')
  })

  it('rejects a non-numeric string', () => {
    const { reports, ctx } = makeCtx()
    validateDuration('fast', ctx)
    expect(reports[0]?.code).toBe('INVALID_DURATION')
  })
})
