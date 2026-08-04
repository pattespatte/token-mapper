/**
 * `dimension` value validator.
 *
 * Delegates to the existing pure {@link isValidDimension} helper (shared with
 * the CSS importer). Reports the catch-all `INVALID_VALUE_FOR_TYPE`.
 */

import { isValidDimension } from '../../utils/cssTypeInference'
import type { RawValue } from '../../types/token'
import type { ValueValidator } from './types'

/** Validate a `dimension` `$value`. Reports `INVALID_VALUE_FOR_TYPE` on mismatch. */
export const validateDimension: ValueValidator = (value, ctx) => {
  if (!isValidDimension(value as RawValue)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_VALUE_FOR_TYPE',
      message: `Value at "${ctx.path}" is not a valid dimension (expected a number with a CSS length unit, e.g. "16px").`,
    })
  }
}
