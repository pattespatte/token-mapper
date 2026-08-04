/**
 * `duration` value validator.
 *
 * The DTCG editor's draft types a `duration` value as a string of the form
 * `${number}ms` — milliseconds only. This is stricter than the CSS-import
 * path's {@link isValidDuration}, which accepts `s` too (CSS allows both);
 * here we follow the token spec, which normalises on `ms`.
 *
 * Reports the granular {@link ValidationCode.INVALID_DURATION} code.
 */

/** `duration` shape: an optional sign, a number, and the literal `ms` suffix. */
const DURATION_RE = /^[-+]?\d+(?:\.\d+)?ms$/

import type { ValueValidator } from './types'

/** Validate a `duration` `$value`. Reports `INVALID_DURATION` on mismatch. */
export const validateDuration: ValueValidator = (value, ctx) => {
  if (typeof value !== 'string' || !DURATION_RE.test(value)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_DURATION',
      message: `Value at "${ctx.path}" is not a valid duration (expected a number followed by "ms", e.g. "200ms").`,
    })
  }
}
