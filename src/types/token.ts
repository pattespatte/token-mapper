/**
 * Internal token model.
 *
 * The DTCG input shape (see `dtcg.ts`) is the *wire* format. Once parsed, the
 * pipeline operates on the types defined here. There are two stages:
 *
 *   1. Parsed (NormalizedToken) — raw, references unresolved.
 *   2. Resolved (ResolvedToken) — references walked to literal values, with
 *      the full alias chain preserved for display.
 *
 * Keeping these distinct makes the diff engine trivially testable: it only
 * needs to see resolved values, and the UI never has to re-walk references.
 */

import type { DtcgType } from './dtcg'
import type { ValidationIssue } from './validation'

/**
 * A token value after JSON parsing, before any reference resolution.
 *
 * - Primitives (`color`, `dimension`, …) are strings or numbers.
 * - Composite types (`typography`, `border`, `shadow`, …) are objects whose
 *   own fields may be literals or `{...}` references.
 * - Arrays cover composite types whose value is a list (e.g. multi-stop
 *   `gradient`, multi-layer `shadow`).
 */
export type RawValue =
  | string
  | number
  | boolean
  | { [key: string]: RawValue }
  | RawValue[]

/**
 * A token as produced by the parser. Identity is the dotted path
 * (e.g. `color.surface.primary.default`).
 *
 * `segments` is the path split into its component parts, kept alongside the
 * joined `path` so consumers don't have to re-split (and so the join/escape
 * logic lives in exactly one place — `utils/path.ts`).
 */
export interface NormalizedToken {
  /** Joined dotted path, e.g. `color.surface.primary.default`. */
  path: string
  /** Path segments, e.g. `['color', 'surface', 'primary', 'default']`. */
  segments: string[]
  /** Raw `$value` as parsed. May be a `{...}` reference. */
  rawValue: RawValue
  /** `$type` if present on the token (or inherited from a parent group). */
  type?: DtcgType
  /** `$description` if present. */
  description?: string
}

/**
 * One hop in a reference chain.
 *
 * For a token whose value is `{color.pink.900}` resolving to `#3d0414`,
 * the chain has a single hop recording the reference path, its raw `{...}`
 * form, and the resolved literal at the end of the chain.
 */
export interface AliasHop {
  /** Path that this hop references, e.g. `color.pink.900`. */
  path: string
  /** Raw reference form, e.g. `{color.pink.900}`. */
  raw: string
  /** Literal value at the end of the chain, if resolution succeeded. */
  resolved?: RawValue
}

/**
 * A token after reference resolution. Carries both the raw form (so the UI can
 * show the alias) and the resolved value (so the diff engine can compare on
 * equality). `hasError` is set when the reference could not be resolved
 * (dangling, cyclic, or too deep); in that case `resolvedValue` falls back to
 * the raw form so the UI can still render something.
 */
export interface ResolvedToken extends NormalizedToken {
  /** Fully-resolved literal value, or the raw form if resolution failed. */
  resolvedValue: RawValue
  /** Reference chain, empty for literal tokens. */
  aliasChain: AliasHop[]
  /** True if the reference chain could not be fully resolved. */
  hasError: boolean
}

/**
 * Token map keyed by dotted path. The core data structure shared by every
 * pipeline stage.
 */
export type TokenMap = Map<string, NormalizedToken>

/**
 * Token map of resolved tokens, keyed by dotted path.
 */
export type ResolvedTokenMap = Map<string, ResolvedToken>

/**
 * A loaded token set — the unit the UI and diff engine work with. A set spans
 * one or more uploaded files merged together (the real design system uses
 * `foundation.json` primitives plus `semantic.json` aliases that reference
 * across files; they form one logical set).
 *
 * `id` is `'A' | 'B'` because the comparison UI has exactly two slots.
 */
export interface TokenSet {
  id: 'A' | 'B'
  /**
   * Human-readable label. Single file → its filename; multiple files →
   * `"N files"` (the per-file names are in `sourceFiles`).
   */
  label: string
  /**
   * Filenames of every source file merged into this set, in load order.
   * Surfaces in the Dropzone so users can see what they've accumulated.
   */
  sourceFiles: string[]
  /** Parsed tokens, references unresolved. */
  tokens: TokenMap
  /** Same tokens after reference resolution. */
  resolved: ResolvedTokenMap
  /** Validation issues found during parse/validate. */
  validation: ValidationIssue[]
}
