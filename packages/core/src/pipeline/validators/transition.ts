/**
 * `transition` composite validator.
 *
 * Per the DTCG spec a `transition` value is an object:
 *   - `duration`       — duration
 *   - `delay`          — duration
 *   - `timingFunction` — cubicBezier
 *
 * Fields are validated as present (optional-but-strict). A non-object value
 * reports {@link ValidationCode.INVALID_COMPOSITE_FIELD}.
 */

import { validateCubicBezier } from './cubicBezier'
import { validateDuration } from './duration'
import { childCtx, type ValueValidator } from './types'

/** Validate a `transition` `$value`. */
export const validateTransition: ValueValidator = (value, ctx) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_COMPOSITE_FIELD',
      message: `Value at "${ctx.path}" is not a valid transition object (expected an object with duration, delay, timingFunction).`,
    })
    return
  }
  const obj = value as Record<string, unknown>
  validatePresent(obj, 'duration', validateDuration, ctx)
  validatePresent(obj, 'delay', validateDuration, ctx)
  validatePresent(obj, 'timingFunction', validateCubicBezier, ctx)
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
