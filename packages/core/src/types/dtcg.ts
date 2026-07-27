/**
 * W3C Design Tokens Format Module (DTCG) — input shape.
 *
 * Reference: https://www.w3.org/community/groups/cgdesign-tokens/
 * Spec: https://design-tokens.github.io/community-group/format/
 *
 * A DTCG file is a tree of groups and tokens. A token is any node carrying a
 * `$value` property; everything else is a group (an organisational container
 * whose children contribute path segments to descendant tokens).
 *
 * The value shape depends on `$type` — `color` is a hex string, `dimension`
 * is a CSS length string, `typography` is an object with sub-fields, and so on.
 * The full set is large; we model the W3C-defined primitive and composite types
 * we render, and fall back to `unknown` for everything else (the validator and
 * the generic renderer handle the latter).
 */

/**
 * Token `$type` values defined by the W3C DTCG spec that this tool understands.
 *
 * The type is a union of string literals plus a trailing `string` so user
 * files can carry types we have not enumerated yet (e.g. future spec additions
 * or vendor extensions). Those land in the generic renderer with an
 * `UNKNOWN_TYPE` warning from the validator.
 */
export type DtcgType =
  // Primitive types
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'number'
  | 'cubicBezier'
  // Composite types
  | 'typography'
  | 'border'
  | 'transition'
  | 'shadow'
  | 'gradient'
  | 'strokeStyle'
  // Extension / unknown — keeps the union open
  | (string & {})

/**
 * A DTCG token. Carries the spec-defined `$`-prefixed properties.
 *
 * `$value` is `unknown` at this layer because the shape varies per `$type`;
 * the validator and type-specific code narrow it. A string value of the form
 * `{path.to.token}` is a reference to another token (an alias).
 */
export interface DtcgToken {
  $value: unknown
  $type?: DtcgType
  $description?: string
}

/**
 * A DTCG group — a non-leaf node. Its children are either more groups or
 * tokens. The two are distinguished at runtime by `isDtcgToken`.
 *
 * We allow arbitrary extra `$`-prefixed properties (e.g. `$extensions`) so the
 * parser doesn't silently drop data Tokens Studio / Figma plugins emit; they
 * are simply ignored downstream.
 */
export interface DtcgGroup {
  [key: string]: DtcgGroup | DtcgToken | unknown
}

/**
 * The parsed top-level shape of a single JSON file: a tree of groups and
 * tokens, with no required root key.
 */
export type DtcgFile = DtcgGroup

/**
 * Runtime type guard: a node is a token if it is a non-null object carrying
 * a `$value` property. Per the W3C spec the presence of `$value` is what
 * distinguishes a token from a group.
 */
export function isDtcgToken(node: unknown): node is DtcgToken {
  return (
    typeof node === 'object' &&
    node !== null &&
    Object.prototype.hasOwnProperty.call(node, '$value')
  )
}
