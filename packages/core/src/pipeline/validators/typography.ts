/**
 * `typography` composite validator.
 *
 * Per the DTCG spec a `typography` value is an object whose sub-fields are
 * each a value of a primitive type:
 *   - `fontFamily`    — fontFamily
 *   - `fontSize`      — dimension
 *   - `fontWeight`    — fontWeight
 *   - `letterSpacing` — dimension
 *   - `lineHeight`    — number
 *
 * Each sub-field is OPTIONAL per spec (a token may declare only `fontFamily`,
 * for example). This validator checks only fields that are present; a missing
 * field is not an error. Each present field is validated by its primitive
 * validator with a child context, so a bad `fontSize` reports at
 * `group.token.fontSize`.
 *
 * Non-object values report {@link ValidationCode.INVALID_COMPOSITE_FIELD} —
 * this is the check that was missing before Phase 2 (a `typography` token
 * with `$value: 42` previously passed silently).
 */

import { validateDimension } from './dimension'
import { validateFontFamily } from './fontFamily'
import { validateFontWeight } from './fontWeight'
import { validateNumber } from './number'
import { childCtx, type FieldCtx, type ValueValidator } from './types'

/** Validate a `typography` `$value`. */
export const validateTypography: ValueValidator = (value, ctx) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_COMPOSITE_FIELD',
      message: `Value at "${ctx.path}" is not a valid typography object (expected an object with optional fontFamily, fontSize, fontWeight, letterSpacing, lineHeight).`,
    })
    return
  }

  const obj = value as Record<string, unknown>
  validateOptionalField(obj, 'fontFamily', validateFontFamily, ctx)
  validateOptionalField(obj, 'fontSize', validateDimension, ctx)
  validateOptionalField(obj, 'fontWeight', validateFontWeight, ctx)
  validateOptionalField(obj, 'letterSpacing', validateDimension, ctx)
  validateOptionalField(obj, 'lineHeight', validateNumber, ctx)
}

/**
 * Validate `obj[fieldName]` with `validator` only when the field is present
 * (not `undefined`). Uses a child context so issues land at
 * `${parentPath}.${fieldName}`. Composite validators share this helper so the
 * "field is optional, but if present must be valid" rule is stated once.
 */
function validateOptionalField(
  obj: Record<string, unknown>,
  fieldName: string,
  validator: ValueValidator,
  parentCtx: FieldCtx
): void {
  if (obj[fieldName] === undefined) return
  validator(obj[fieldName], childCtx(parentCtx, fieldName))
}
