/**
 * `color` value validator.
 *
 * Delegates to the existing pure {@link isValidColor} helper (shared with the
 * CSS importer's type inference). Reports the catch-all `INVALID_VALUE_FOR_TYPE`
 * rather than a granular code — color has no further sub-codes, and reusing
 * the existing code keeps the validator's output stable for callers that
 * filter on it.
 */

import { isValidColor } from '../../utils/cssTypeInference'
import type { RawValue } from '../../types/token'
import type { ValueValidator } from './types'

/** Validate a `color` `$value`. Reports `INVALID_VALUE_FOR_TYPE` on mismatch. */
export const validateColor: ValueValidator = (value, ctx) => {
  if (!isValidColor(value as RawValue)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_VALUE_FOR_TYPE',
      message: `Value at "${ctx.path}" is not a valid color (expected hex, rgb(), hsl(), or a named color).`,
    })
  }
}
