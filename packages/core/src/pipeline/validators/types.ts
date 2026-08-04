/**
 * Shared types for the per-type validator registry
 * (`pipeline/validators/`).
 *
 * Each validator is a pure function `(value, ctx) => void` that inspects a
 * value and, when it violates the spec rule for its `$type`, calls
 * `ctx.report(...)` with the current path, a {@link ValidationCode}, message,
 * and optional spec reference. Validators never throw and never return a
 * boolean — they either report or they don't, which lets composite validators
 * recurse into primitive validators without short-circuiting on the first bad
 * sub-field (every invalid field surfaces its own issue).
 */

import type { ValidationCode } from '../../types/validation'

/**
 * One report call. Validators pass `ctx.path` explicitly (rather than the
 * sink closing over a path) so child contexts — built via {@link childCtx} —
 * report at their own location without the sink needing to know the
 * parent/child relationship. The caller's sink applies `SPEC_REFERENCE[code]`
 * as the default `reference`.
 */
export interface ReportDetails {
  /** Dotted path of the offending location (the validator passes `ctx.path`). */
  path: string
  code: ValidationCode
  message: string
  /** Override for the spec reference; defaults to `SPEC_REFERENCE[code]`. */
  reference?: string
}

/**
 * Per-call validation context. Carries the dotted path of the value being
 * checked (extended with sub-field names by composite validators — e.g.
 * `group.token.fontSize`) and a `report` sink the validator writes issues to.
 */
export interface FieldCtx {
  /** Dotted path of the value being validated (e.g. `group.token.fontSize`). */
  path: string
  /**
   * Record one issue. Validators pass `ctx.path` (or a derived path for
   * indexed elements) so the issue lands at the right location.
   */
  report: (details: ReportDetails) => void
}

/**
 * A validator for one `$type`. Returns nothing; calls `ctx.report` zero or
 * more times. Kept `void` (not `boolean`) so composite validators can recurse
 * into primitive validators and collect every sub-field error rather than
 * stopping at the first.
 */
export type ValueValidator = (value: unknown, ctx: FieldCtx) => void

/**
 * Build a child context for a named sub-field. The child carries the appended
 * path (`parent.fieldName`) and shares the parent's `report` sink reference,
 * so issues land in the same array. Because validators pass `ctx.path` on
 * each report, the child's issues automatically carry the child path — e.g.
 * an invalid `typography.fontSize` reports at `group.token.fontSize`.
 *
 * Used by composite validators (typography, shadow, border, …) to recurse
 * into their per-field primitive validators.
 */
export function childCtx(ctx: FieldCtx, fieldName: string): FieldCtx {
  // Array-indexed children (fieldName like `[0]`) append without a separating
  // dot so the path reads `token[0]`, not `token.[0]`. Named fields keep the
  // dot: `token.fontSize`.
  const separator = fieldName.startsWith('[') ? '' : '.'
  return {
    path: `${ctx.path}${separator}${fieldName}`,
    report: ctx.report,
  }
}
