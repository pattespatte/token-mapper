/**
 * Validation model.
 *
 * The validator inspects a parsed token map and emits a list of issues. Issues
 * are surfaced in a panel shown *after* the visual gallery (per the PRD):
 * invalid tokens are excluded from the diff engine, but most can still be
 * rendered with their raw values so the user sees what's broken.
 */

/**
 * Issue severity.
 *
 * - `error`   — token is unusable; excluded from diff, often unrenderable.
 * - `warning` — token is usable but suspicious (e.g. missing `$type`, unknown
 *   `$type` value). Still included in the diff and rendered where possible.
 */
export type Severity = 'error' | 'warning'

/**
 * Machine-readable validation codes. Used by the UI for icons/filtering and
 * by tests for assertions (more stable than matching message strings).
 */
export type ValidationCode =
  // JSON-level (parser-emitted)
  | 'INVALID_JSON'
  | 'DUPLICATE_PATH'
  // Per-token structural
  | 'MISSING_TYPE'
  | 'UNKNOWN_TYPE'
  // Per-token value-shape
  | 'INVALID_VALUE_FOR_TYPE'
  // Reference-level
  | 'DANGLING_REFERENCE'
  | 'CYCLIC_REFERENCE'
  | 'REFERENCE_TOO_DEEP'

/**
 * A single validation issue tied to a token path (or, for file-level issues
 * like `INVALID_JSON`, to a synthetic path such as the filename).
 */
export interface ValidationIssue {
  /** Dotted path of the offending token, or a file-level identifier. */
  path: string
  severity: Severity
  code: ValidationCode
  /** Human-readable explanation, safe to show in the UI. */
  message: string
}
