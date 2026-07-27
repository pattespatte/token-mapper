import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * CLI integration tests — spawn the built `dist/index.js` with fixture
 * files and assert on stdout / exit code. Requires `npm run build` to have
 * produced the artifact; the tests skip gracefully if it's missing.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_PATH = resolve(__dirname, '../dist/index.js')
const REPO_ROOT = resolve(__dirname, '../../..')
const APP_DEMO = resolve(REPO_ROOT, 'app/src/data/demo')

const hasCli = existsSync(CLI_PATH)

/** Spawn the CLI with args; return { stdout, stderr, exitCode }. */
function run(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [CLI_PATH, ...args], {
      encoding: 'utf-8',
      cwd: REPO_ROOT,
      timeout: 10000,
    })
    return { stdout, stderr: '', exitCode: 0 }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    }
  }
}

describe.skipIf(!hasCli)('dtcg-mapper CLI', () => {
  it('prints Markdown diff for two JSON files', () => {
    const { stdout, exitCode } = run([
      'diff',
      `${APP_DEMO}/foundation.json`,
      `${APP_DEMO}/semantic.json`,
      '--format', 'md',
    ])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('# Diff: foundation.json vs semantic.json')
    expect(stdout).toContain('## Missing in B')
    expect(stdout).toContain('## Extra in B')
  })

  it('emits valid JSON when --format json', () => {
    const { stdout, exitCode } = run([
      'diff',
      `${APP_DEMO}/foundation.json`,
      `${APP_DEMO}/semantic.json`,
      '--format', 'json',
    ])
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout) as { counts: { matching: number; changed: number } }
    expect(parsed.counts).toBeDefined()
    expect(typeof parsed.counts.matching).toBe('number')
  })

  it('reads CSS files', () => {
    const { stdout, exitCode } = run([
      'diff',
      `${APP_DEMO}/composition.css`,
      `${APP_DEMO}/foundation.json`,
      '--format', 'md',
    ])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('# Diff: composition.css vs foundation.json')
  })

  it('mixed CSS + JSON merges correctly', () => {
    // composition.css has tokens like color.brand, space.md, etc.
    // foundation.json has color.gray.*, color.indigo.*, etc.
    // Diff should show some matching if both reference the same hex.
    const { stdout, exitCode } = run([
      'diff',
      `${APP_DEMO}/composition.css`,
      `${APP_DEMO}/foundation.json`,
      '--format', 'json',
    ])
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout) as { counts: { matching: number; changed: number; missing: number; extra: number } }
    const total = parsed.counts.matching + parsed.counts.changed + parsed.counts.missing + parsed.counts.extra
    expect(total).toBeGreaterThan(0)
  })

  it('writes to file when --output is given', () => {
    const outPath = resolve(REPO_ROOT, 'tmp-cli-test-output.md')
    try {
      const { exitCode } = run([
        'diff',
        `${APP_DEMO}/foundation.json`,
        `${APP_DEMO}/semantic.json`,
        '--output', outPath,
      ])
      expect(exitCode).toBe(0)
      expect(existsSync(outPath)).toBe(true)
      const content = readFileSync(outPath, 'utf-8')
      expect(content).toContain('# Diff: foundation.json vs semantic.json')
    } finally {
      if (existsSync(outPath)) rmSync(outPath)
    }
  })

  it('exits 1 when a file does not exist', () => {
    const { stderr, exitCode } = run([
      'diff', 'nonexistent.json', 'other.json',
    ])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('could not read file')
  })

  it('exits 1 for unsupported file extension', () => {
    // Create a fake file path — the read attempt will fail first, but if
    // we name a real unsupported file the extension check kicks in.
    const { stderr, exitCode } = run([
      'diff',
      `${APP_DEMO}/foundation.json`,
      `${REPO_ROOT}/README.md`,
    ])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('unsupported file type')
  })

  it('prints help and exits 0 with --help', () => {
    const { stdout, exitCode } = run(['--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage: dtcg-mapper')
    expect(stdout).toContain('--format')
  })

  it('prints version with --version', () => {
    const { stdout, exitCode } = run(['--version'])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('rejects invalid --format value', () => {
    const { stderr, exitCode } = run([
      'diff', 'a.json', 'b.json', '--format', 'xml',
    ])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('--format must be')
  })

  it('requires the diff subcommand', () => {
    const { stderr, exitCode } = run(['foo'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('expected "diff" subcommand')
  })

  it('requires two file arguments', () => {
    const { stderr, exitCode } = run(['diff', 'only-one.json'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('requires two file arguments')
  })
})
