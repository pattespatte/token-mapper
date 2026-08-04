import { describe, expect, it } from 'vitest'
import { validateShadow } from '@/pipeline/validators/shadow'
import { makeCtx } from './helpers'

/**
 * shadow composite validator — single object or array of layered-shadow
 * objects; each { color, offsetX, offsetY, blur, spread }. Sub-fields
 * validated as present (optional-but-strict).
 */
describe('validateShadow', () => {
  it('accepts a complete single-layer shadow', () => {
    const { reports, ctx } = makeCtx()
    validateShadow(
      {
        color: '#000000',
        offsetX: '0px',
        offsetY: '4px',
        blur: '8px',
        spread: '0px',
      },
      ctx
    )
    expect(reports).toEqual([])
  })

  it('accepts a layered shadow (array of objects)', () => {
    const { reports, ctx } = makeCtx()
    validateShadow(
      [
        { color: '#000', offsetX: '0', offsetY: '1px', blur: '2px', spread: '0' },
        { color: '#fff', offsetX: '0', offsetY: '2px', blur: '4px', spread: '0' },
      ],
      ctx
    )
    expect(reports).toEqual([])
  })

  it('reports INVALID_COMPOSITE_FIELD for a non-object value', () => {
    const { reports, ctx } = makeCtx()
    validateShadow('0 0 4px black', ctx)
    expect(reports[0]?.code).toBe('INVALID_COMPOSITE_FIELD')
  })

  it('reports a bad sub-field with the field name in the path', () => {
    const { reports, ctx } = makeCtx('shadow.md')
    validateShadow({ color: '#000', offsetX: 'wide', offsetY: '4px' }, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
    expect(reports[0]?.path).toBe('shadow.md.offsetX')
  })

  it('reports an invalid color sub-field', () => {
    const { reports, ctx } = makeCtx('s')
    validateShadow({ color: 'notacolor', offsetX: '0', offsetY: '0' }, ctx)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
    expect(reports[0]?.path).toBe('s.color')
  })
})
