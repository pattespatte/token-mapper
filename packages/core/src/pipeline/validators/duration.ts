/**
 * `duration` value validator.
 *
 * This tool's data model treats a `duration` value as a string of the form
 * `${number}ms` or `${number}s` (e.g. `"200ms"`, `"0.3s"`) — the form the
 * resolver, diff explainer, and {@link DurationSample} renderer all consume,
 * and the form earlier DTCG drafts specified. The latest editor's draft has
 * moved to an object `{ value: number, unit: 'ms' | 's' }`; adopting that is
 * a larger change (it would touch the data model, every fixture, and the
 * renderer) and is out of scope for the validation uplift. Both units (`ms`
 * and `s`) are accepted here because the spec permits both and the renderer
 * normalises between them.
 *
 * Reports the granular {@link ValidationCode.INVALID_DURATION} code.
 */

/** `duration` shape: an optional sign, a number, and a `ms` or `s` suffix. */
const DURATION_RE = /^[-+]?\d+(?:\.\d+)?(ms|s)$/

import type { ValueValidator } from './types'

/** Validate a `duration` `$value`. Reports `INVALID_DURATION` on mismatch. */
export const validateDuration: ValueValidator = (value, ctx) => {
  if (typeof value !== 'string' || !DURATION_RE.test(value)) {
    ctx.report({
      path: ctx.path,
      code: 'INVALID_DURATION',
      message: `Value at "${ctx.path}" is not a valid duration (expected a number followed by "ms" or "s", e.g. "200ms" or "0.3s").`,
    })
  }
}
