/**
 * Parser — DTCG JSON files into a `TokenMap`.
 *
 * Inputs: one or more `{ name, content }` records (file name + raw JSON text).
 * Output: a merged `TokenMap` of all tokens across all files, plus a list of
 * validation issues (JSON parse errors, duplicate paths).
 *
 * This stage does *not* resolve references or check value shapes — that's the
 * validator and resolver's job. It only establishes identity (the dotted path)
 * and captures raw values.
 *
 * Multi-file merging: the real design system ships `foundation.json` (primitives)
 * and `semantic.json` (aliases referencing across files). They form one logical
 * set, so we merge them into a single map. The first occurrence of a path wins;
 * later duplicates are recorded as `DUPLICATE_PATH` issues and dropped.
 */

import { isDtcgToken, type DtcgFile, type DtcgType } from '../types/dtcg'
import type { NormalizedToken, TokenMap } from '../types/token'
import type { ValidationIssue } from '../types/validation'
import { joinPath } from '../utils/path'
import { SPEC_REFERENCE } from './references'

/** A single uploaded file as the parser sees it. */
export interface InputFile {
  /** File name, used in error messages. */
  name: string
  /** Raw file contents (JSON text). */
  content: string
}

/** Parser result. */
export interface ParseResult {
  tokens: TokenMap
  issues: ValidationIssue[]
}

/**
 * Parse one or more DTCG JSON files into a single merged token map.
 *
 * Files are parsed independently — a JSON syntax error in one file does not
 * abort the others; the bad file is recorded as an `INVALID_JSON` issue and
 * skipped. All successfully parsed files are then walked together into one map.
 */
export function parseFiles(files: readonly InputFile[]): ParseResult {
  const tokens: TokenMap = new Map()
  const issues: ValidationIssue[] = []

  const parsed: DtcgFile[] = []
  for (const file of files) {
    let data: unknown
    try {
      data = JSON.parse(file.content)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      issues.push({
        path: file.name,
        severity: 'error',
        code: 'INVALID_JSON',
        message: `Could not parse ${file.name}: ${message}`,
        reference: SPEC_REFERENCE.INVALID_JSON,
      })
      continue
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      issues.push({
        path: file.name,
        severity: 'error',
        code: 'INVALID_JSON',
        message: `${file.name}: top-level JSON must be an object, got ${
          Array.isArray(data) ? 'array' : typeof data
        }.`,
        reference: SPEC_REFERENCE.INVALID_JSON,
      })
      continue
    }
    parsed.push(data as DtcgFile)
  }

  for (const tree of parsed) {
    walk(tree, [], tokens, issues, undefined)
  }

  return { tokens, issues }
}

/**
 * Recursive tree walker. Visits every node; at each node decides token vs.
 * group via `isDtcgToken` and either records the token or recurses into the
 * group's children.
 *
 * `inheritedType` implements the spec's group-level `$type` inheritance: a
 * group may declare `$type` once, and every descendant token that does not
 * declare its own `$type` inherits the group's. A descendant's explicit
 * `$type` always wins (strict-spec semantics — no conflict warning). The
 * top-level call passes `undefined` (the root has no inherited type).
 */
function walk(
  node: DtcgFile,
  ancestors: string[],
  tokens: TokenMap,
  issues: ValidationIssue[],
  inheritedType: DtcgType | undefined
): void {
  // A group may declare `$type`; if so, it becomes the inherited type for the
  // group's descendants (unless they declare their own). Computed once per
  // node so the recursion below passes it through unchanged.
  const nodeType = (node as Record<string, unknown>).$type
  const typeForChildren =
    typeof nodeType === 'string' ? (nodeType as DtcgType) : inheritedType

  for (const key of Object.keys(node)) {
    // Skip `$`-prefixed properties on groups (e.g. `$description`, `$type`,
    // `$extensions`) — they describe the group itself, not a child token.
    if (key.startsWith('$')) continue

    const child = (node as Record<string, unknown>)[key]
    const childPath = [...ancestors, key]

    if (isDtcgToken(child)) {
      const path = joinPath(childPath)
      if (tokens.has(path)) {
        issues.push({
          path,
          severity: 'warning',
          code: 'DUPLICATE_PATH',
          message: `Duplicate token path "${path}" — earlier definition kept.`,
          reference: SPEC_REFERENCE.DUPLICATE_PATH,
        })
        continue
      }
      tokens.set(path, makeToken(path, childPath, child, typeForChildren))
    } else if (typeof child === 'object' && child !== null) {
      // Group — recurse, passing down the (possibly updated) inherited type.
      walk(child as DtcgFile, childPath, tokens, issues, typeForChildren)
    }
    // Primitive values directly under a group (not wrapped in a $value token)
    // are silently ignored — they aren't valid DTCG, but the parser shouldn't
    // throw on garbage data. The validator can flag structural issues later.
  }
}

/**
 * Build a NormalizedToken from a DtcgToken node and its path.
 *
 * Type resolution: an explicit `$type` on the token wins; otherwise the
 * inherited type from the nearest declaring ancestor (if any) is applied.
 * A token with neither stays typeless and the validator will emit
 * `MISSING_TYPE`.
 */
function makeToken(
  path: string,
  segments: string[],
  raw: {
    $value: unknown
    $type?: DtcgType
    $description?: string
  },
  inheritedType: DtcgType | undefined
): NormalizedToken {
  const token: NormalizedToken = {
    path,
    segments,
    rawValue: raw.$value as NormalizedToken['rawValue'],
  }
  // Explicit $type wins; fall back to the inherited group $type.
  if (raw.$type !== undefined) {
    token.type = raw.$type
  } else if (inheritedType !== undefined) {
    token.type = inheritedType
  }
  if (raw.$description !== undefined) token.description = raw.$description
  return token
}
