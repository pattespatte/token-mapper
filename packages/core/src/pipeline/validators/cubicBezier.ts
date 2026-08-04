/**
 * `cubicBezier` value validator.
 *
 * Per the DTCG spec a `cubicBezier` value is an array of exactly four numbers
 * `[x1, y1, x2, y2]` defining a CSS easing curve. Two distinct failure modes:
 *
 *   1. Wrong shape (not an array, wrong length, or a non-number element) →
 *      {@link ValidationCode.INVALID_CUBIC_BEZIER}.
 *   2. An x-coordinate (indices 0 or 2) outside `[0, 1]` →
 *      {@link ValidationCode.INVALID_CUBIC_BEZIER_RANGE}, reported with the
 *      offending index in the path (`group.token[2]`).
 *
 * Range nuance: the spec constrains only the *x* components (`x1`, `x2` —
 * indices 0 and 2) to `[0, 1]`; the *y* components (`y1`, `y2` — indices 1
 * and 3) may be any real number (e.g. an overshooting `ease-out-back` with
 * y2 = 1.5). We enforce finiteness on all four, and the `[0, 1]` range only
 * on the x indices.
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
  //
  // Per spec the four numbers are [x1, y1, x2, y2] defining a CSS easing curve.
  // The x coordinates (indices 0 and 2) MUST lie in [0, 1]; the y coordinates
  // (indices 1 and 3) may be any real number. We enforce finiteness on all
  // four, and the [0, 1] range only on the x indices.
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
    const isXCoord = i === 0 || i === 2
    if (
      isXCoord &&
      (el < CUBIC_BEZIER_RANGE.min || el > CUBIC_BEZIER_RANGE.max)
    ) {
      idxCtx.report({
        path: idxCtx.path,
        code: 'INVALID_CUBIC_BEZIER_RANGE',
        message: `cubicBezier x-coordinate ${el} at "${idxCtx.path}" is outside the allowed range [0, 1].`,
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
