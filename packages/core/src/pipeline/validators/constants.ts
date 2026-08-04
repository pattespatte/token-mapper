/**
 * Spec-derived constants for the per-type validators.
 *
 * Values mirror the W3C Design Tokens Format Module and the CSS values it
 * references. Enumerations (`WEIGHT_ALIASES`, `STROKE_STYLE_VALUES`,
 * `LINE_CAP_VALUES`) are typed as `readonly tuple`s so validators can use
 * `Array.includes()` without `as string[]` coercion, and so a typo in a test
 * fixture surfaces as a type error rather than a silent false negative.
 *
 * Source for the alias/enum lists:
 * [design-token-validator](https://github.com/AnimaApp/design-token-validator/blob/main/src/constants.ts),
 * which itself sourced them from the W3C and CSS specs.
 */

/**
 * CSS font-weight keyword aliases. The DTCG spec allows these in addition to
 * numeric weights 1–1000. Used by {@link validateFontWeight}.
 */
export const WEIGHT_ALIASES = [
  'thin',
  'hairline',
  'extra-light',
  'ultra-light',
  'light',
  'normal',
  'regular',
  'book',
  'medium',
  'semi-bold',
  'demi-bold',
  'bold',
  'extra-bold',
  'ultra-bold',
  'black',
  'heavy',
  'extra-black',
  'ultra-black',
] as const

/**
 * String-form `strokeStyle` values (CSS `line-style` production).
 * Used by {@link validateStrokeStyle} for the string arm.
 */
export const STROKE_STYLE_VALUES = [
  'solid',
  'dashed',
  'dotted',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
] as const

/**
 * `lineCap` enum for object-form `strokeStyle`. CSS `stroke-linecap`.
 * Used by {@link validateStrokeStyle} for the object arm.
 */
export const LINE_CAP_VALUES = ['butt', 'round', 'square'] as const

/**
 * Numeric range for a `cubicBezier` control-point component. Per spec each of
 * the four numbers may be any real number, but the *first and third* (the
 * horizontal control points) must lie in `[0, 1]`. We apply the range to all
 * four for a conservative check — see {@link validateCubicBezier} for the
 * nuance and the deliberate choice.
 */
export const CUBIC_BEZIER_RANGE = { min: 0, max: 1 } as const

/** Numeric range for a `fontWeight` value. CSS weights run 1–1000. */
export const FONT_WEIGHT_RANGE = { min: 1, max: 1000 } as const

/**
 * Numeric range for a gradient stop's `position`. Per spec a stop's position
 * is a number in `[0, 1]` (a percentage along the gradient).
 */
export const GRADIENT_POSITION_RANGE = { min: 0, max: 1 } as const
