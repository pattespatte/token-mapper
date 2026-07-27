/**
 * CSS custom-properties importer (`:root` scope).
 *
 * Parses `--kebab-case: value;` declarations from `:root { … }` blocks in
 * plain CSS source, producing a `TokenMap` that the rest of the pipeline
 * (validate → resolve → diff) consumes identically to the JSON parser's
 * output. `TokenMap` is the integration boundary; downstream stages are
 * format-agnostic.
 *
 * Deliberately narrow scope (decision recorded in the Tier 1 PRD):
 *   - `:root { … }` only. No cascade, no `@media :root`, no `.theme-*`,
 *     no `html, :root` combinator selectors. Only a selector that is
 *     exactly `:root` (modulo surrounding whitespace) matches.
 *   - `var(--x)` whole-value references are rewritten to `{x}` so the
 *     existing resolver picks them up. Partial references like
 *     `1px solid var(--color)` stay literal (no partial-ref support).
 *   - `var(--x, fallback)` does NOT parse the fallback; the whole value
 *     is recorded as the literal string.
 *   - `$type` inferred from value shape via `src/utils/cssTypeInference`.
 *   - Aliased tokens (`var(--x)`) inherit `$type` from their target on a
 *     second pass.
 *
 * Pure: no Vue, no I/O, no side effects. Never throws — malformed input
 * produces as many tokens as can be salvaged plus a list of issues.
 */

import type { NormalizedToken, RawValue, TokenMap } from '@/types/token'
import type { ValidationIssue } from '@/types/validation'
import type { ParseResult } from '@/pipeline/parse'
import { joinPath } from '@/utils/path'
import { inferType } from '@/utils/cssTypeInference'

/** Regex for `/* … *​/` block comments — stripped before scanning. */
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g

/**
 * Regex for a top-level `:root` selector followed by `{`. Matches `:root {`
 * with any whitespace between `:root` and `{`, but NOT `html, :root {`
 * (combinator) or `:root.foo {` (compound) or `@media … :root {` (nested).
 *
 * The leading `(?:^|\s)` ensures we don't match `:root` inside another
 * selector like `html:root` (though that's vanishingly rare in real CSS).
 * `:root` must be its own selector.
 */
const ROOT_SELECTOR = /(?:^|\n)\s*:root\s*\{/g

/**
 * Regex for one custom-property declaration inside `:root`:
 * `--<name>: <value>;`. Captures the name (without `--`) and the raw value
 * (trimmed). The terminator is `;`, the closing `}` of the block, or the
 * end of the body string — whichever comes first. The closing-`}` case is
 * a lookahead so the regex doesn't consume it (letting subsequent
 * `:root`-block scanning continue cleanly). The end-of-string alternative
 * handles the last declaration in a body that's already been sliced out
 * of its enclosing braces.
 */
const DECLARATION = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}/]+?)\s*(?:;|(?=\})|$)/g

/**
 * Regex for a whole-value `var(--x)` reference. Matches `var( --foo-bar )`
 * with optional inner whitespace, where the only contents are the custom-
 * property name (no comma, no fallback, no arithmetic). Anything else
 * (`var(--x, fallback)`, `1px solid var(--color)`, etc.) does NOT match
 * and stays literal.
 */
const WHOLE_VAR_REFERENCE = /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/

/**
 * Parse one CSS source file into a `TokenMap` plus a list of issues.
 *
 * Mirrors `parseFiles`'s return shape so `useTokenSets.buildSet` can consume
 * either uniformly. Multiple `:root` blocks in the file merge into one map;
 * first occurrence of a path wins, later duplicates emit `DUPLICATE_PATH`.
 *
 * The `name` parameter mirrors `InputFile.name` for API symmetry with
 * `parseFiles`; it's reserved for future use (e.g. including the source
 * filename in path-collision error messages). Unused for now — leading
 * underscore signals intentional non-use without changing the public
 * signature.
 */
export function parseCss(_name: string, content: string): ParseResult {
  const tokens: TokenMap = new Map()
  const issues: ValidationIssue[] = []

  // Strip block comments first so they don't interfere with declaration scanning.
  // Line comments (`//`) are not valid CSS and are left in place; they end up
  // inside declaration values and fail type inference downstream, which is fine.
  const stripped = content.replace(BLOCK_COMMENT, '')

  // Find every top-level `:root { … }` block and walk its declarations.
  for (const block of findRootBlocks(stripped)) {
    for (const { propName, rawValue } of extractDeclarations(block)) {
      const segments = kebabToSegments(propName)
      const path = joinPath(segments)

      if (tokens.has(path)) {
        issues.push({
          path,
          severity: 'warning',
          code: 'DUPLICATE_PATH',
          message: `Duplicate token path "${path}" — earlier definition kept.`,
        })
        continue
      }

      const token = makeToken(path, segments, rawValue)
      tokens.set(path, token)
    }
  }

  // Pass 1: infer $type from value shape for literal values. Reference values
  // ({...}) are skipped — they get their type from the alias target in pass 2.
  applyTypeInference(tokens)

  // Pass 2: alias tokens inherit $type from their target. Walk the map again
  // so forward-declared aliases (CSS doesn't require forward declaration)
  // still find their target's type. Missing/untyped targets leave $type
  // undefined — the validator's MISSING_TYPE warning surfaces it.
  applyAliasTypeInheritance(tokens)

  return { tokens, issues }
}

/**
 * Pass 1: set `token.type` based on the value's shape via `inferType`. Only
 * applies to tokens whose value is NOT a whole-value `{...}` reference —
 * those are handled by the alias-inheritance pass.
 *
 * Mutates the tokens in place. Pure-ish: no I/O, no side effects beyond the
 * token map.
 */
function applyTypeInference(tokens: TokenMap): void {
  for (const token of tokens.values()) {
    if (isWholeReference(token.rawValue)) continue
    const inferred = inferType(token.rawValue)
    if (inferred !== undefined) {
      token.type = inferred
    }
  }
}

/**
 * Pass 2: for every alias token (`{...}` whole-value reference), look up the
 * target in the map and copy its `$type` if present. Mutates in place.
 *
 * If the target is missing (dangling reference) or has no `$type`, the alias
 * keeps `undefined` — the validator handles both cases via its existing
 * `DANGLING_REFERENCE` and `MISSING_TYPE` checks.
 */
function applyAliasTypeInheritance(tokens: TokenMap): void {
  for (const token of tokens.values()) {
    if (!isWholeReference(token.rawValue)) continue
    const targetPath = extractReferencePath(token.rawValue)
    if (targetPath === null) continue
    const target = tokens.get(targetPath)
    if (target?.type !== undefined) {
      token.type = target.type
    }
  }
}

/** True when `value` is a string of the form `{path.to.token}`. */
function isWholeReference(value: RawValue): boolean {
  return typeof value === 'string' && /^\{[^}]+\}$/.test(value)
}

/** Extract the dotted path from a `{...}` reference string; null if not a reference. */
function extractReferencePath(value: RawValue): string | null {
  if (typeof value !== 'string') return null
  const m = /^\{([^}]+)\}$/.exec(value)
  return m === null ? null : (m[1] ?? null)
}

/**
 * Find every top-level `:root { … }` block in `source` and yield its body
 * (the text between the opening `{` and the matching closing `}`). Brace-
 * matching scan from each match of `ROOT_SELECTOR`; handles nested braces
 * inside the block (rare in `:root` but defensive — e.g. `var(--x)` doesn't
 * nest, but a future `calc(…)` could).
 *
 * Returns an array rather than a generator for simpler unit-testing.
 */
function findRootBlocks(source: string): string[] {
  const blocks: string[] = []
  ROOT_SELECTOR.lastIndex = 0
  let selectorMatch: RegExpExecArray | null
  while ((selectorMatch = ROOT_SELECTOR.exec(source)) !== null) {
    // The opening `{` is the last char of the match. Walk forward from there
    // counting `{`/`}` until balanced.
    const openBraceIndex = (selectorMatch.index ?? 0) + (selectorMatch[0]?.length ?? 0) - 1
    const body = extractBalancedBlock(source, openBraceIndex)
    if (body !== null) blocks.push(body)
  }
  return blocks
}

/**
 * Given `source` and the index of an opening `{`, return the text between
 * it and its matching closing `}` (exclusive of the braces themselves).
 * Returns null if no matching close is found (unterminated block — treat as
 * if the block extends to end of source).
 */
function extractBalancedBlock(source: string, openIndex: number): string | null {
  if (source[openIndex] !== '{') return null
  let depth = 0
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return source.slice(openIndex + 1, i)
      }
    }
  }
  // Unterminated block — return everything after the opening brace.
  return source.slice(openIndex + 1)
}

/** One parsed declaration: the property name (with `--` stripped) and its raw value. */
interface RawDeclaration {
  propName: string
  rawValue: string
}

/**
 * Scan `blockBody` (the text inside `:root { … }`) for custom-property
 * declarations. Returns each `--name: value` pair with the leading `--`
 * stripped from the name and the value trimmed.
 */
function extractDeclarations(blockBody: string): RawDeclaration[] {
  const out: RawDeclaration[] = []
  DECLARATION.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DECLARATION.exec(blockBody)) !== null) {
    const propName = m[1] ?? ''
    const rawValue = (m[2] ?? '').trim()
    if (propName.length > 0) {
      out.push({ propName, rawValue })
    }
  }
  return out
}

/**
 * Convert a CSS custom-property name (without leading `--`) to dotted-path
 * segments by splitting on `-`. `color-accent-primary` →
 * `['color', 'accent', 'primary']`. Names with no `-` (e.g. `myVar`) become
 * a single-segment path `['myVar']` — case is preserved because CSS custom
 * properties are case-sensitive.
 */
function kebabToSegments(name: string): string[] {
  return name.split('-').filter((seg) => seg.length > 0)
}

/**
 * Build a `NormalizedToken` from a parsed declaration, applying the `var()`
 * whole-value rewrite. `$type` is set in Phase 5 (second pass after the
 * whole map is built, so alias targets can be looked up).
 */
function makeToken(
  path: string,
  segments: string[],
  rawValue: string
): NormalizedToken {
  const value: RawValue = rewriteVarReference(rawValue)
  const token: NormalizedToken = { path, segments, rawValue: value }
  return token
}

/**
 * If `rawValue` is exactly `var(--foo-bar)`, rewrite to `{foo.bar}` so the
 * existing resolver treats it as a whole-value reference. Otherwise return
 * the value unchanged (including `var(--x, fallback)`, mixed values like
 * `1px solid var(--color)`, etc.).
 *
 * Phase 4 task — kept here as a single-purpose helper so the second-pass
 * type-inheritance logic in Phase 5 can also call `WHOLE_VAR_REFERENCE` to
 * identify alias tokens.
 */
function rewriteVarReference(rawValue: string): RawValue {
  const m = WHOLE_VAR_REFERENCE.exec(rawValue)
  if (m === null) return rawValue
  const varName = (m[1] ?? '').slice(2) // strip leading `--`
  const segments = kebabToSegments(varName)
  return `{${joinPath(segments)}}`
}
