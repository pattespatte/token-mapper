import { describe, expect, it } from 'vitest'
import { validateStrokeStyle } from '@/pipeline/validators/strokeStyle'
import { makeCtx } from './helpers'

/**
 * strokeStyle validator — string enum (solid/dashed/…) OR object
 * { dashArray: Dimension[], lineCap: 'butt'|'round'|'square' }.
 */
describe('validateStrokeStyle', () => {
  it('accepts each line-style string', () => {
    for (const v of ['solid', 'dashed', 'dotted', 'double']) {
      const { reports, ctx } = makeCtx()
      validateStrokeStyle(v, ctx)
      expect(reports, `style ${v} should be valid`).toEqual([])
    }
  })

  it('rejects an unknown style string', () => {
    const { reports, ctx } = makeCtx()
    validateStrokeStyle('wavy', ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_STROKE_STYLE')
    expect(reports[0]?.message).toMatch(/wavy/)
  })

  it('accepts a well-formed object with dashArray and lineCap', () => {
    const { reports, ctx } = makeCtx()
    validateStrokeStyle(
      { dashArray: ['2px', '4px'], lineCap: 'round' },
      ctx
    )
    expect(reports).toEqual([])
  })

  it('reports at field-path when dashArray is missing or not an array', () => {
    const { reports, ctx } = makeCtx('token')
    validateStrokeStyle({ lineCap: 'round' }, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_STROKE_STYLE')
    expect(reports[0]?.message).toMatch(/dashArray/)
  })

  it('reports each invalid dashArray element via the dimension validator', () => {
    const { reports, ctx } = makeCtx('token')
    validateStrokeStyle({ dashArray: ['2px', 'big'], lineCap: 'round' }, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
    expect(reports[0]?.path).toBe('token.dashArray[1]')
  })

  it('reports when lineCap is missing or invalid', () => {
    const { reports, ctx } = makeCtx('token')
    validateStrokeStyle({ dashArray: ['2px'], lineCap: 'bork' }, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_STROKE_STYLE')
    expect(reports[0]?.message).toMatch(/lineCap/)
  })

  it('rejects a non-string, non-object value', () => {
    const { reports, ctx } = makeCtx()
    validateStrokeStyle(42, ctx)
    expect(reports[0]?.code).toBe('INVALID_STROKE_STYLE')
  })
})
