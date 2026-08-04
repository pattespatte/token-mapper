import { describe, expect, it } from 'vitest'
import { validateTypography } from '@/pipeline/validators/typography'
import { makeCtx } from './helpers'

/**
 * typography composite validator — recurses into fontFamily/fontWeight/
 * dimension/number primitives per sub-field. The key behaviour: a bad
 * sub-field reports at `path.fieldName`, and a non-object value reports
 * INVALID_COMPOSITE_FIELD (the bug fixed in Phase 2 — previously passed).
 */
describe('validateTypography', () => {
  it('accepts a complete, valid typography object', () => {
    const { reports, ctx } = makeCtx()
    validateTypography(
      {
        fontFamily: 'Inter',
        fontSize: '16px',
        fontWeight: 400,
        letterSpacing: '0.1px',
        lineHeight: 1.5,
      },
      ctx
    )
    expect(reports).toEqual([])
  })

  it('accepts a partial object — sub-fields are optional per spec', () => {
    const { reports, ctx } = makeCtx()
    validateTypography({ fontFamily: 'Inter' }, ctx)
    expect(reports).toEqual([])
  })

  it('reports INVALID_COMPOSITE_FIELD for a non-object value', () => {
    const { reports, ctx } = makeCtx('token')
    validateTypography(42, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_COMPOSITE_FIELD')
    expect(reports[0]?.path).toBe('token')
  })

  it('reports INVALID_COMPOSITE_FIELD for an array', () => {
    const { reports, ctx } = makeCtx()
    validateTypography(['Inter', '16px'], ctx)
    expect(reports[0]?.code).toBe('INVALID_COMPOSITE_FIELD')
  })

  it('reports a bad sub-field with the field name in the path', () => {
    const { reports, ctx } = makeCtx('type.body')
    validateTypography({ fontFamily: 'Inter', fontSize: 'big' }, ctx)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('INVALID_VALUE_FOR_TYPE')
    expect(reports[0]?.path).toBe('type.body.fontSize')
  })

  it('reports a bad fontWeight sub-field with INVALID_FONT_WEIGHT', () => {
    const { reports, ctx } = makeCtx('type.body')
    validateTypography({ fontWeight: 9999 }, ctx)
    expect(reports[0]?.code).toBe('INVALID_FONT_WEIGHT')
    expect(reports[0]?.path).toBe('type.body.fontWeight')
  })

  it('reports each bad sub-field independently (no short-circuit)', () => {
    const { reports, ctx } = makeCtx('t')
    validateTypography(
      { fontSize: 'big', fontWeight: 9999, lineHeight: NaN },
      ctx
    )
    expect(reports).toHaveLength(3)
    const fields = reports.map((r) => r.path.replace(/^t\./, '')).sort()
    expect(fields).toEqual(['fontSize', 'fontWeight', 'lineHeight'])
  })
})
