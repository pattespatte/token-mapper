/**
 * `number` value validator.
 *
 * Per the DTCG spec a `number` value is a JSON number. The only constraint
 * the validator enforces beyond type-of-number is finiteness: `NaN` and
 * `±Infinity` are rejected (they are valid JS numbers but serialise to
 * invalid JSON — `NaN`, `Infinity` — and break downstream consumers).
 * Reports the granular {@link ValidationCode.INVALID_NUMBER} code.
 */

import type { ValueValidator } from './types'

/** Validate a `number` `$value`. Reports `INVALID_NUMBER` on mismatch. */
export const validateNumber: ValueValidator = (value, ctx) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_NUMBER',
      message: `Value at "${ctx.path}" is not a valid number (expected a finite JSON number; NaN and Infinity are rejected).`,
    })
  }
}
