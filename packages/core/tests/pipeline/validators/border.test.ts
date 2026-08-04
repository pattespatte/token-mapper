import { describe, expect, it } from 'vitest'
import { validateBorder } from '@/pipeline/validators/border'
import { makeCtx } from './helpers'

/** border composite — { color, width, style }; recurses into primitives. */
describe('validateBorder', () => {
  it('accepts a valid border object', () => {
    const { reports, ctx } = makeCtx()
    validateBorder({ color: '#000', width: '1px', style: 'solid' }, ctx)
    expect(reports).toEqual([])
  })

  it('accepts a border with object-form strokeStyle', () => {
    const { reports, ctx } = makeCtx()
    validateBorder(
      {
        color: '#000',
        width: '1px',
        style: { dashArray: ['2px', '4px'], lineCap: 'round' },
      },
      ctx
    )
    expect(reports).toEqual([])
  })

  it('reports INVALID_COMPOSITE_FIELD for a non-object', () => {
    const { reports, ctx } = makeCtx()
    validateBorder('1px solid black', ctx)
    expect(reports[0]?.code).toBe('INVALID_COMPOSITE_FIELD')
  })

  it('reports a bad width sub-field with the field in the path', () => {
    const { reports, ctx } = makeCtx('border.md')
    validateBorder({ color: '#000', width: 'wide', style: 'solid' }, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
    expect(reports[0]?.path).toBe('border.md.width')
  })

  it('reports a bad style sub-field with INVALID_STROKE_STYLE', () => {
    const { reports, ctx } = makeCtx('b')
    validateBorder({ color: '#000', width: '1px', style: 'wavy' }, ctx)
    expect(reports[0]?.code).toBe('INVALID_STROKE_STYLE')
    expect(reports[0]?.path).toBe('b.style')
  })
})
