#!/usr/bin/env node
/**
 * @dtcg-mapper/cli — command-line diff tool for W3C design tokens.
 *
 * Reads two token files (`.json` or `.css`), runs the @dtcg-mapper/core
 * pipeline (parse → validate → resolve → diff → explainDiff), and writes
 * a Markdown or JSON report to stdout or a file.
 *
 * Usage:
 *   dtcg-mapper diff <fileA> <fileB> [--format md|json] [--output <path>]
 *   dtcg-mapper --help
 *   dtcg-mapper --version
 *
 * Exit codes:
 *   0 — successful run (regardless of diff content)
 *   1 — file not found, parse error, invalid args
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'
import {
  parseFiles,
  parseCss,
  validate,
  resolve,
  diff,
  explainDiff,
  toMarkdownDiffReport,
  toJsonDiffReport,
  SPEC_REFERENCE,
  type InputFile,
  type ParseResult,
  type ReportMeta,
  type TokenMap,
  type ValidationIssue,
} from '@dtcg-mapper/core'

const VERSION = '0.0.0'

/** Print usage to stderr (when invoked via --help, print to stdout and exit 0). */
function printHelp(toStdout = false): void {
  const usage = `Usage: dtcg-mapper diff <fileA> <fileB> [options]

Compare two design-token files and emit a diff report.

Commands:
  diff <fileA> <fileB>   Compare two files (.json or .css). Files are merged
                        per-source: extension determines the parser.

Options:
  --format <md|json>     Output format. Default: md.
  --output <path>        Write to file instead of stdout.
  -h, --help             Show this help.
  -v, --version          Print version (${VERSION}).

Exit codes:
  0  Success (regardless of whether the diff is non-empty).
  1  File not found, parse error, or invalid arguments.

Examples:
  dtcg-mapper diff foundation.json modified.json
  dtcg-mapper diff foundation.css modified.css --format json > diff.json
  dtcg-mapper diff a.json b.json --output diff.md
`
  if (toStdout) {
    process.stdout.write(usage)
    process.exit(0)
  } else {
    process.stderr.write(usage)
  }
}

interface ParsedArgs {
  positional: string[]
  format: 'md' | 'json'
  output: string | null
}

/** Parse `process.argv`. Exits with error message on invalid input. */
function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { positional: [], format: 'md', output: null }
  // Drop node binary path and script path.
  const args = argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '-h' || a === '--help') {
      printHelp(true)
    } else if (a === '-v' || a === '--version') {
      process.stdout.write(`${VERSION}\n`)
      process.exit(0)
    } else if (a === '--format') {
      const next = args[i + 1]
      if (next !== 'md' && next !== 'json') {
        process.stderr.write(`error: --format must be "md" or "json", got "${next ?? '(missing)'}"\n`)
        process.exit(1)
      }
      out.format = next
      i++
    } else if (a === '--output') {
      const next = args[i + 1]
      if (next === undefined) {
        process.stderr.write('error: --output requires a path argument\n')
        process.exit(1)
      }
      out.output = next
      i++
    } else if (a.startsWith('--')) {
      process.stderr.write(`error: unknown flag "${a}"\n`)
      printHelp()
      process.exit(1)
    } else {
      out.positional.push(a)
    }
  }
  return out
}

/** Read a file as UTF-8 text; exit 1 on error. */
function readFileOrExit(name: string): string {
  try {
    return readFileSync(name, 'utf-8')
  } catch {
    process.stderr.write(`error: could not read file "${name}"\n`)
    process.exit(1)
  }
}

/** Route one InputFile through the right parser based on extension. */
function parseOne(input: InputFile): ParseResult {
  const ext = input.name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'css') return parseCss(input.name, input.content)
  if (ext === 'json') return parseFiles([input])
  process.stderr.write(
    `error: unsupported file type ".${ext}" (${input.name}). Only .json and .css are accepted.\n`
  )
  process.exit(1)
}

/** Merge per-file results into one TokenMap (first-wins, DUPLICATE_PATH on collision). */
function mergeResults(results: ParseResult[]): { tokens: TokenMap; issues: ValidationIssue[] } {
  const tokens: TokenMap = new Map()
  const issues: ValidationIssue[] = []
  for (const result of results) {
    for (const [path, token] of result.tokens) {
      if (tokens.has(path)) {
        issues.push({
          path,
          severity: 'warning',
          code: 'DUPLICATE_PATH',
          message: `Duplicate token path "${path}" — earlier definition kept.`,
          reference: SPEC_REFERENCE.DUPLICATE_PATH,
        })
      } else {
        tokens.set(path, token)
      }
    }
    issues.push(...result.issues)
  }
  return { tokens, issues }
}

/** Read a list of files and produce one merged, validated, resolved TokenMap. */
function loadSet(label: string, files: string[]): {
  resolved: ReturnType<typeof resolve>
  parseIssues: ValidationIssue[]
} {
  const inputs: InputFile[] = files.map((f) => ({ name: f, content: readFileOrExit(f) }))
  const results = inputs.map(parseOne)
  const { tokens, issues: parseIssues } = mergeResults(results)
  // Validation issues are reported but don't block the diff — broken refs
  // still diff against their raw resolved form.
  validate(tokens)
  const resolved = resolve(tokens)
  return { resolved, parseIssues }
}

/** Attach explanations to changed tokens (mirrors useDiff's enrichment). */
function enrichWithExplanations(
  d: ReturnType<typeof diff>
): ReturnType<typeof diff> {
  return {
    matching: d.matching,
    changed: d.changed.map((td) =>
      td.a !== undefined && td.b !== undefined
        ? { ...td, explanation: explainDiff(td.a, td.b) }
        : td
    ),
    missing: d.missing,
    extra: d.extra,
  }
}

/** Derive a label from file paths: last segment without extension. */
function labelFromPath(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] ?? path
}

function main(): void {
  const args = parseArgs(process.argv)

  if (args.positional[0] !== 'diff') {
    process.stderr.write('error: expected "diff" subcommand\n')
    printHelp()
    process.exit(1)
  }

  const fileArgs = args.positional.slice(1)
  if (fileArgs.length < 2) {
    process.stderr.write('error: diff requires two file arguments: <fileA> <fileB>\n')
    printHelp()
    process.exit(1)
  }
  if (fileArgs.length > 2) {
    process.stderr.write(
      `error: diff takes exactly two files, got ${fileArgs.length}: ${fileArgs.join(' ')}\n`
    )
    process.exit(1)
  }

  const [fileA, fileB] = fileArgs as [string, string]
  const a = loadSet('A', [fileA!])
  const b = loadSet('B', [fileB!])

  const rawDiff = diff(a.resolved, b.resolved)
  const enriched = enrichWithExplanations(rawDiff)

  const meta: ReportMeta = {
    setALabel: labelFromPath(fileA!),
    setBLabel: labelFromPath(fileB!),
    generatedAt: new Date(),
  }

  const output = args.format === 'json'
    ? toJsonDiffReport(enriched, meta)
    : toMarkdownDiffReport(enriched, meta)

  if (args.output !== null) {
    writeFileSync(args.output, output, 'utf-8')
  } else {
    process.stdout.write(output)
  }

  process.exit(0)
}

main()
