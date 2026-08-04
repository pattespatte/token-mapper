/**
 * Per-type validator registry.
 *
 * Replaces the old monolithic `checkValueShape` switch in `validate.ts`. The
 * registry is two maps keyed by `$type`:
 *
 *   - {@link primitiveValidators} — color, dimension, fontFamily, fontWeight,
 *     duration, number, cubicBezier, strokeStyle. Each checks one leaf value.
 *   - {@link compositeValidators} — typography, border, transition, shadow,
 *     gradient. Each recurses into the primitive validators for its sub-fields
 *     (see e.g. {@link validateTypography}), so a bad `typography.fontSize`
 *     reports at `group.token.fontSize` rather than just `group.token`.
 *
 * {@link validateValue} is the single entry point: it looks up the type in
 * whichever map contains it and calls the validator. Unknown types are a
 * no-op here — the caller (`validate`) already emitted `UNKNOWN_TYPE`.
 *
 * Design notes:
 *   - Splitting primitive vs. composite (rather than one flat map) makes the
 *     "composites recurse into primitives" relationship explicit and keeps
 *     each validator file focused on one type.
 *   - Validators are `void`, not `boolean`: a composite validates every
 *     sub-field rather than stopping at the first failure, so the user sees
 *     all the problems in one pass.
 *   - The `FieldCtx.report` sink is supplied by the caller; validators never
 *     touch the issue array directly. This keeps them pure and independently
 *     testable (tests pass a collecting `report` and assert on its calls).
 */

import type { DtcgType } from '../../types/dtcg'
import { validateBorder } from './border'
import { validateColor } from './color'
import { validateCubicBezier } from './cubicBezier'
import { validateDimension } from './dimension'
import { validateDuration } from './duration'
import { validateFontFamily } from './fontFamily'
import { validateFontWeight } from './fontWeight'
import { validateGradient } from './gradient'
import { validateNumber } from './number'
import { validateShadow } from './shadow'
import { validateStrokeStyle } from './strokeStyle'
import { validateTransition } from './transition'
import { validateTypography } from './typography'
import type { FieldCtx, ValueValidator } from './types'

// Re-export the shared types so callers can import everything from one place.
export type { FieldCtx, ValueValidator, childCtx } from './types'

/** Primitive `$type` → validator. Leaf values only. */
export const primitiveValidators: Partial<Record<DtcgType, ValueValidator>> = {
  color: validateColor,
  dimension: validateDimension,
  fontFamily: validateFontFamily,
  fontWeight: validateFontWeight,
  duration: validateDuration,
  number: validateNumber,
  cubicBezier: validateCubicBezier,
  strokeStyle: validateStrokeStyle,
}

/** Composite `$type` → validator. Each recurses into primitive validators. */
export const compositeValidators: Partial<Record<DtcgType, ValueValidator>> = {
  typography: validateTypography,
  border: validateBorder,
  transition: validateTransition,
  shadow: validateShadow,
  gradient: validateGradient,
}

/** Composite types (the keys of {@link compositeValidators}). */
export const COMPOSITE_TYPES = new Set<DtcgType>([
  'typography',
  'border',
  'transition',
  'shadow',
  'gradient',
])

/**
 * Dispatch `value` to the validator registered for `type`, if any. No-op for
 * unknown types (the caller reports `UNKNOWN_TYPE` separately) and for types
 * with no registered validator.
 *
 * @returns `true` when a validator ran, `false` when the type has no entry
 *   (lets the caller decide whether to fall back to a generic check).
 */
export function validateValue(
  type: DtcgType,
  value: unknown,
  ctx: FieldCtx
): boolean {
  const validator =
    (COMPOSITE_TYPES.has(type)
      ? compositeValidators[type]
      : primitiveValidators[type]) ?? undefined
  if (validator === undefined) return false
  validator(value, ctx)
  return true
}
