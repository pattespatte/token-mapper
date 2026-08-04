/**
 * `strokeStyle` value validator.
 *
 * Per the DTCG spec a `strokeStyle` value is either:
 *   - a string — one of the CSS line-style keywords ({@link STROKE_STYLE_VALUES}),
 *     or
 *   - an object `{ dashArray: Dimension[], lineCap: LineCap }` for dashed
 *     strokes, where `dashArray` is an array of dimension strings and
 *     `lineCap` is one of {@link LINE_CAP_VALUES}.
 *
 * Reports the granular {@link ValidationCode.INVALID_STROKE_STYLE} for any
 * shape/enum failure. Sub-field errors append the field name to the path
 * (e.g. `group.token.lineCap`).
 */

import { LINE_CAP_VALUES, STROKE_STYLE_VALUES } from './constants'
import { validateDimension } from './dimension'
import { childCtx, type ValueValidator } from './types'

/** Validate a `strokeStyle` `$value`. */
export const validateStrokeStyle: ValueValidator = (value, ctx) => {
  if (typeof value === 'string') {
    if (!(STROKE_STYLE_VALUES as readonly string[]).includes(value)) {
      ctx.report({
        path: ctx.path,
        code: 'INVALID_STROKE_STYLE',
        message: `Value "${value}" at "${ctx.path}" is not a valid strokeStyle string (expected one of: ${STROKE_STYLE_VALUES.join(', ')}).`,
      })
    }
    return
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>

    // dashArray: required, must be an array of dimension strings.
    const dashArray = obj['dashArray']
    const dashArrayCtx = childCtx(ctx, 'dashArray')
    if (!Array.isArray(dashArray)) {
      dashArrayCtx.report({
        path: dashArrayCtx.path,
        code: 'INVALID_STROKE_STYLE',
        message: `Field "dashArray" at "${dashArrayCtx.path}" must be an array of dimension strings.`,
      })
    } else {
      // Validate each element via the dimension validator (field-indexed path).
      for (let i = 0; i < dashArray.length; i++) {
        validateDimension(dashArray[i], childCtx(ctx, `dashArray[${i}]`))
      }
    }

    // lineCap: required, must be one of the enum values.
    const lineCap = obj['lineCap']
    const lineCapCtx = childCtx(ctx, 'lineCap')
    if (
      typeof lineCap !== 'string' ||
      !(LINE_CAP_VALUES as readonly string[]).includes(lineCap)
    ) {
      lineCapCtx.report({
        path: lineCapCtx.path,
        code: 'INVALID_STROKE_STYLE',
        message: `Field "lineCap" at "${lineCapCtx.path}" must be one of: ${LINE_CAP_VALUES.join(', ')}.`,
      })
    }
    return
  }

  ctx.report({
    path: ctx.path,
    code: 'INVALID_STROKE_STYLE',
    message: `Value at "${ctx.path}" is not a valid strokeStyle (expected a line-style string or an object { dashArray, lineCap }).`,
  })
}
