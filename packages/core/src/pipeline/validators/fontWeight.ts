/**
 * `fontWeight` value validator.
 *
 * Per the DTCG spec a `fontWeight` value is either:
 *   - a number in the CSS weight range [1, 1000], or
 *   - one of the CSS weight keyword aliases (`normal`, `bold`, `light`,
 *     `semi-bold`, … — see {@link WEIGHT_ALIASES}).
 *
 * Reports the granular {@link ValidationCode.INVALID_FONT_WEIGHT} code so the
 * UI can distinguish weight issues from generic shape issues. This is stricter
 * than the CSS-import path's {@link isValidFontWeight}, which only accepts
 * strings (it infers from CSS text); here the value arrives as a real JS
 * number or string from JSON, and the type is already declared.
 */

import { FONT_WEIGHT_RANGE, WEIGHT_ALIASES } from './constants'
import type { ValueValidator } from './types'

/** Validate a `fontWeight` `$value`. Reports `INVALID_FONT_WEIGHT` on mismatch. */
export const validateFontWeight: ValueValidator = (value, ctx) => {
  if (typeof value === 'number') {
    if (
      !Number.isFinite(value) ||
      value < FONT_WEIGHT_RANGE.min ||
      value > FONT_WEIGHT_RANGE.max
    ) {
      ctx.report({
        path: ctx.path,
        code: 'INVALID_FONT_WEIGHT',
        message: `Value ${String(value)} at "${ctx.path}" is not a valid fontWeight (expected a number in [1, 1000]).`,
      })
    }
    return
  }
  if (typeof value === 'string') {
    if (!(WEIGHT_ALIASES as readonly string[]).includes(value)) {
      ctx.report({
        path: ctx.path,
        code: 'INVALID_FONT_WEIGHT',
        message: `Value "${value}" at "${ctx.path}" is not a valid fontWeight alias (expected one of: ${WEIGHT_ALIASES.join(', ')}).`,
      })
    }
    return
  }
  ctx.report({
    path: ctx.path,
    code: 'INVALID_FONT_WEIGHT',
    message: `Value at "${ctx.path}" is not a valid fontWeight (expected a number in [1, 1000] or a weight alias string).`,
  })
}
