/**
 * `gradient` composite validator.
 *
 * Per the DTCG spec a `gradient` value is a non-empty array of gradient
 * stops, each an object:
 *   - `color`    — color
 *   - `position` — number in `[0, 1]` ({@link GRADIENT_POSITION_RANGE})
 *
 * Reports {@link ValidationCode.INVALID_GRADIENT} for a non-array or empty
 * array; each present stop field is validated by its primitive validator with
 * a stop-indexed child path (`group.token[0].color`).
 */

import { validateColor } from './color'
import { GRADIENT_POSITION_RANGE } from './constants'
import { validateNumber } from './number'
import { childCtx, type ValueValidator } from './types'

/** Validate a `gradient` `$value`. */
export const validateGradient: ValueValidator = (value, ctx) => {
  if (!Array.isArray(value)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_GRADIENT',
      message: `Value at "${ctx.path}" is not a valid gradient (expected an array of gradient stops).`,
    })
    return
  }
  if (value.length === 0) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_GRADIENT',
      message: `Gradient at "${ctx.path}" contains no stops (expected a non-empty array).`,
    })
    return
  }

  value.forEach((stop, i) => {
    const stopCtx = childCtx(ctx, `[${i}]`)
    if (typeof stop !== 'object' || stop === null || Array.isArray(stop)) {
      stopCtx.report({
        path: stopCtx.path,
        code: 'INVALID_GRADIENT',
        message: `Gradient stop at "${stopCtx.path}" must be an object with color and position.`,
      })
      return
    }
    const obj = stop as Record<string, unknown>

    // color — required, validate via the color primitive.
    const colorCtx = childCtx(stopCtx, 'color')
    if (obj['color'] === undefined) {
      colorCtx.report({
        path: colorCtx.path,
        code: 'INVALID_GRADIENT',
        message: `Gradient stop at "${stopCtx.path}" is missing "color".`,
      })
    } else {
      validateColor(obj['color'], colorCtx)
    }

    // position — required, finite number in [0, 1].
    const position = obj['position']
    const positionCtx = childCtx(stopCtx, 'position')
    if (position === undefined) {
      positionCtx.report({
        path: positionCtx.path,
        code: 'INVALID_GRADIENT',
        message: `Gradient stop at "${stopCtx.path}" is missing "position".`,
      })
    } else {
      validateNumber(position, positionCtx)
      if (
        typeof position === 'number' &&
        Number.isFinite(position) &&
        (position < GRADIENT_POSITION_RANGE.min ||
          position > GRADIENT_POSITION_RANGE.max)
      ) {
        positionCtx.report({
          path: positionCtx.path,
          code: 'INVALID_GRADIENT',
          message: `Gradient stop position ${position} at "${positionCtx.path}" is outside [0, 1].`,
        })
      }
    }
  })
}
