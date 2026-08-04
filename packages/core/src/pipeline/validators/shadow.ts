/**
 * `shadow` composite validator.
 *
 * Per the DTCG spec a `shadow` value is either a single shadow object or an
 * array of shadow objects (layered shadows). Each shadow object has:
 *   - `color`   — color
 *   - `offsetX` — dimension
 *   - `offsetY` — dimension
 *   - `blur`    — dimension
 *   - `spread`  — dimension
 *
 * `offsetX` and `offsetY` are required by the spec; `blur`, `spread`, and
 * `color` are commonly optional in CSS but the token spec lists all five. We
 * validate fields that are present (lenient on missing fields, strict on
 * present ones — same policy as {@link validateTypography}). Layered shadows
 * get an `[i]` index in the path.
 */

import { validateColor } from './color'
import { validateDimension } from './dimension'
import { childCtx, type FieldCtx, type ValueValidator } from './types'

/** Validate a `shadow` `$value` (single object or array of objects). */
export const validateShadow: ValueValidator = (value, ctx) => {
  // Normalise to a list of layers. A bare object is a one-layer shadow.
  let layers: unknown[]
  if (Array.isArray(value)) {
    layers = value
  } else if (typeof value === 'object' && value !== null) {
    layers = [value]
  } else {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_COMPOSITE_FIELD',
      message: `Value at "${ctx.path}" is not a valid shadow (expected an object or an array of objects).`,
    })
    return
  }

  layers.forEach((layer, i) => {
    const layerCtx =
      Array.isArray(value) && value.length > 1
        ? childCtx(ctx, `[${i}]`)
        : ctx
    validateLayer(layer, layerCtx)
  })
}

/** Validate one shadow layer object. */
function validateLayer(layer: unknown, ctx: FieldCtx): void {
  if (typeof layer !== 'object' || layer === null || Array.isArray(layer)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_COMPOSITE_FIELD',
      message: `Shadow layer at "${ctx.path}" must be an object.`,
    })
    return
  }
  const obj = layer as Record<string, unknown>
  validatePresent(obj, 'color', validateColor, ctx)
  validatePresent(obj, 'offsetX', validateDimension, ctx)
  validatePresent(obj, 'offsetY', validateDimension, ctx)
  validatePresent(obj, 'blur', validateDimension, ctx)
  validatePresent(obj, 'spread', validateDimension, ctx)
}

/** Validate `obj[fieldName]` only when present; child context for the path. */
function validatePresent(
  obj: Record<string, unknown>,
  fieldName: string,
  validator: ValueValidator,
  parentCtx: FieldCtx
): void {
  if (obj[fieldName] === undefined) return
  validator(obj[fieldName], childCtx(parentCtx, fieldName))
}
