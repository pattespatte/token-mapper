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

import { isDtcgToken, type DtcgFile, type DtcgType } from '@/types/dtcg'
import type { NormalizedToken, TokenMap } from '@/types/token'
import type { ValidationIssue } from '@/types/validation'
import { joinPath } from '@/utils/path'

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
      })
      continue
    }
    parsed.push(data as DtcgFile)
  }

  for (const tree of parsed) {
    walk(tree, [], tokens, issues)
  }

  return { tokens, issues }
}

/**
 * Recursive tree walker. Visits every node; at each node decides token vs.
 * group via `isDtcgToken` and either records the token or recurses into the
 * group's children.
 *
 * `inheritedType` lets a group declare `$type` once and have descendant
 * tokens inherit it (spec-allowed). We don't currently surface group-level
 * `$type` — the validator will flag tokens missing their own type — but the
 * walker is structured so adding that is a one-line change later.
 */
function walk(
  node: DtcgFile,
  ancestors: string[],
  tokens: TokenMap,
  issues: ValidationIssue[]
): void {
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
        })
        continue
      }
      tokens.set(path, makeToken(path, childPath, child))
    } else if (typeof child === 'object' && child !== null) {
      // Group — recurse.
      walk(child as DtcgFile, childPath, tokens, issues)
    }
    // Primitive values directly under a group (not wrapped in a $value token)
    // are silently ignored — they aren't valid DTCG, but the parser shouldn't
    // throw on garbage data. The validator can flag structural issues later.
  }
}

/** Build a NormalizedToken from a DtcgToken node and its path. */
function makeToken(
  path: string,
  segments: string[],
  raw: {
    $value: unknown
    $type?: DtcgType
    $description?: string
  }
): NormalizedToken {
  const token: NormalizedToken = {
    path,
    segments,
    rawValue: raw.$value as NormalizedToken['rawValue'],
  }
  if (raw.$type !== undefined) token.type = raw.$type
  if (raw.$description !== undefined) token.description = raw.$description
  return token
}
