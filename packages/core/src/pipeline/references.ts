/**
 * Spec reference URLs for validation issues.
 *
 * Every `ValidationCode` maps to the W3C Design Tokens Format Module section
 * that defines the rule the issue enforces. The URL is attached to each
 * `ValidationIssue` as `reference` and rendered as a "Spec ↗" link in the
 * validation panel, turning a bare "this is wrong" into "here is the rule
 * you broke".
 *
 * Anchor scheme mirrors [design-token-validator](https://github.com/AnimaApp/design-token-validator)
 * and targets the editor's draft at `tr.designtokens.org` (the live
 * `design-tokens.github.io` redirect resolves to the same anchors).
 *
 * `Record<ValidationCode, string>` is deliberate: TypeScript errors if a new
 * code is added to the union without an entry here, so the map and the union
 * cannot drift apart.
 */

import type { ValidationCode } from '../types/validation'

/** Base URL for the W3C Design Tokens Format Module editor's draft. */
const SPEC_BASE = 'https://tr.designtokens.org/format/'

/**
 * Map every `ValidationCode` to its spec section anchor.
 *
 * Looked up by `validate.ts`, `parse.ts`, the CSS importer, and the CLI's
 * merge step when constructing `ValidationIssue`s. Phase 2 of the validation
 * uplift will append entries for the new granular codes
 * (`INVALID_FONT_WEIGHT`, `INVALID_STROKE_STYLE`, etc.).
 */
export const SPEC_REFERENCE: Record<ValidationCode, string> = {
  // JSON-level (parser-emitted)
  INVALID_JSON: `${SPEC_BASE}#file-format`,
  DUPLICATE_PATH: `${SPEC_BASE}#character-restrictions`,
  // Per-token structural
  MISSING_TYPE: `${SPEC_BASE}#type-0`,
  UNKNOWN_TYPE: `${SPEC_BASE}#types`,
  // Per-token value-shape
  INVALID_VALUE_FOR_TYPE: `${SPEC_BASE}#types`,
  // Per-token value-shape — granular (Phase 2)
  INVALID_FONT_WEIGHT: `${SPEC_BASE}#font-weight`,
  INVALID_STROKE_STYLE: `${SPEC_BASE}#stroke-style`,
  INVALID_CUBIC_BEZIER: `${SPEC_BASE}#cubic-bezier`,
  INVALID_CUBIC_BEZIER_RANGE: `${SPEC_BASE}#cubic-bezier`,
  INVALID_DURATION: `${SPEC_BASE}#duration`,
  INVALID_NUMBER: `${SPEC_BASE}#number`,
  INVALID_GRADIENT: `${SPEC_BASE}#gradient`,
  INVALID_COMPOSITE_FIELD: `${SPEC_BASE}#types`,
  // Reference-level
  DANGLING_REFERENCE: `${SPEC_BASE}#aliases-references`,
  CYCLIC_REFERENCE: `${SPEC_BASE}#aliases-references`,
  REFERENCE_TOO_DEEP: `${SPEC_BASE}#aliases-references`,
  // File-level (router-emitted)
  UNSUPPORTED_FILE_TYPE: `${SPEC_BASE}#file-format`,
}
