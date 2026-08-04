/**
 * `fontFamily` value validator.
 *
 * Per the DTCG spec a `fontFamily` value is a `string | string[]` — any
 * non-empty string (or array of non-empty strings) is acceptable, since the
 * type is declared and the value's job is just to name a family. This is
 * deliberately looser than the CSS-import path's {@link isValidFontFamily},
 * which *infers* type from ambiguous CSS strings and so requires a quoted
 * name or a generic-family terminator to avoid false positives. Here the type
 * is already known; we only check the shape.
 */

import type { ValueValidator } from './types'

/** Validate a `fontFamily` `$value`. Reports `INVALID_VALUE_FOR_TYPE` on mismatch. */
export const validateFontFamily: ValueValidator = (value, ctx) => {
  const ok =
    (typeof value === 'string' && value.length > 0) ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.every((v) => typeof v === 'string' && v.length > 0))
  if (!ok) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_VALUE_FOR_TYPE',
      message: `Value at "${ctx.path}" is not a valid fontFamily (expected a non-empty string or array of non-empty strings).`,
    })
  }
}
