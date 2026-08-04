/**
 * `border` composite validator.
 *
 * Per the DTCG spec a `border` value is an object:
 *   - `color`  — color
 *   - `width`  — dimension
 *   - `style`  — strokeStyle (string or object form)
 *
 * Fields are validated as present (same optional-but-strict policy as the
 * other composites). A non-object value reports
 * {@link ValidationCode.INVALID_COMPOSITE_FIELD}.
 */

import { validateColor } from './color'
import { validateDimension } from './dimension'
import { validateStrokeStyle } from './strokeStyle'
import { childCtx, type ValueValidator } from './types'

/** Validate a `border` `$value`. */
export const validateBorder: ValueValidator = (value, ctx) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_COMPOSITE_FIELD',
      message: `Value at "${ctx.path}" is not a valid border object (expected an object with color, width, style).`,
    })
    return
  }
  const obj = value as Record<string, unknown>
  validatePresent(obj, 'color', validateColor, ctx)
  validatePresent(obj, 'width', validateDimension, ctx)
  validatePresent(obj, 'style', validateStrokeStyle, ctx)
}

/** Validate `obj[fieldName]` only when present; child context for the path. */
function validatePresent(
  obj: Record<string, unknown>,
  fieldName: string,
  validator: ValueValidator,
  parentCtx: import('./types').FieldCtx
): void {
  if (obj[fieldName] === undefined) return
  validator(obj[fieldName], childCtx(parentCtx, fieldName))
}
