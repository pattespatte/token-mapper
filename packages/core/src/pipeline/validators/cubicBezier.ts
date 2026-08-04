/**
 * `cubicBezier` value validator.
 *
 * Per the DTCG spec a `cubicBezier` value is an array of exactly four numbers
 * `[x1, y1, x2, y2]` defining a CSS easing curve. Two distinct failure modes:
 *
 *   1. Wrong shape (not an array, wrong length, or a non-number element) →
 *      {@link ValidationCode.INVALID_CUBIC_BEZIER}.
 *   2. A numeric element outside the spec range {@link CUBIC_BEZIER_RANGE}
 *      (`[0, 1]`) → {@link ValidationCode.INVALID_CUBIC_BEZIER_RANGE}, reported
 *      with the offending index in the path (`group.token[2]`).
 *
 * Range nuance: strictly the CSS spec constrains only the *x* components
 * (`x1`, `x2` — the 1st and 3rd elements) to `[0, 1]`; the *y* components may
 * be any real number. We apply `[0, 1]` to all four for a conservative check
 * — real-world easing curves (`ease`, `ease-in`, …) keep every component in
 * `[0, 1]` anyway, and a token with a y-component outside that range is more
 * likely a mistake than an intentional overshoot. The constants file documents
 * this choice; loosen in Phase 4 if real datasets demand it.
 */

import { CUBIC_BEZIER_RANGE } from './constants'
import type { FieldCtx, ValueValidator } from './types'

/** Validate a `cubicBezier` `$value`. */
export const validateCubicBezier: ValueValidator = (value, ctx) => {
  if (!Array.isArray(value)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_CUBIC_BEZIER',
      message: `Value at "${ctx.path}" is not a valid cubicBezier (expected an array of 4 numbers).`,
    })
    return
  }
  if (value.length !== 4) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_CUBIC_BEZIER',
      message: `Value at "${ctx.path}" is not a valid cubicBezier (expected exactly 4 numbers, got ${value.length}).`,
    })
    // Still fall through: a length-3 array with a bad element would otherwise
    // pass silently. We check elements up to min(length, 4) below.
  }

  // Validate each element. Use an indexed child context so the issue path
  // points at the offending component (e.g. `group.token[2]`).
  for (let i = 0; i < Math.min(value.length, 4); i++) {
    const el = value[i]
    const idxCtx = indexCtx(ctx, i)
    if (typeof el !== 'number' || !Number.isFinite(el)) {
      idxCtx.report({
        path: idxCtx.path,
        code: 'INVALID_CUBIC_BEZIER',
        message: `cubicBezier element at "${idxCtx.path}" must be a finite number.`,
      })
      continue
    }
    if (el < CUBIC_BEZIER_RANGE.min || el > CUBIC_BEZIER_RANGE.max) {
      idxCtx.report({
        path: idxCtx.path,
        code: 'INVALID_CUBIC_BEZIER_RANGE',
        message: `cubicBezier element ${el} at "${idxCtx.path}" is outside the allowed range [0, 1].`,
      })
    }
  }
}

/** Build a context whose path is `${parentPath}[${i}]` (shares the report sink). */
function indexCtx(ctx: FieldCtx, i: number): FieldCtx {
  return {
    path: `${ctx.path}[${i}]`,
    report: ctx.report,
  }
}
