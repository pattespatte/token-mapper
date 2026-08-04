import { describe, expect, it } from 'vitest'
import { serializeTokens } from '@/pipeline/serialize'
import { parseFiles, type InputFile } from '@/pipeline/parse'
import { resolve } from '@/pipeline/resolve'
import { parseCss } from '@/ingest/cssCustomProperties'
import type { TokenMap, ResolvedTokenMap } from '@/types/token'

/** Shorthand for creating an InputFile. */
function file(name: string, content: string): InputFile {
  return { name, content }
}

/** Parse raw DTCG JSON into a TokenMap. */
function tokensOf(...json: string[]): TokenMap {
  const files: InputFile[] = json.map((content, i) => ({
    name: `test-${i}.json`,
    content,
  }))
  return parseFiles(files).tokens
}

describe('serializeTokens', () => {
  // -----------------------------------------------------------------------
  // 1. Round-trip: parse → serialize → parse again → same paths & values
  // -----------------------------------------------------------------------
  it('round-trips a parsed file through serialize and parse again', () => {
    const original = JSON.stringify({
      color: {
        primary: { $value: '#ff0000', $type: 'color' },
        surface: { $value: '{color.primary}', $type: 'color' },
      },
      spacing: {
        md: { $value: '16px', $type: 'dimension' },
      },
    })
    const tokens = tokensOf(original)
    const serialized = serializeTokens(tokens)
    const parsed = parseFiles([file('roundtrip.json', serialized)])

    expect(parsed.issues).toEqual([])
    expect([...parsed.tokens.keys()].sort()).toEqual(
      [...tokens.keys()].sort()
    )
    for (const path of parsed.tokens.keys()) {
      const orig = tokens.get(path)
      const rt = parsed.tokens.get(path)
      expect(rt?.rawValue).toEqual(orig?.rawValue)
      expect(rt?.type).toEqual(orig?.type)
    }
  })

  // ---------------------------------------------------------------
  // 2. Raw mode keeps reference strings verbatim
  // ---------------------------------------------------------------
  it('keeps {ref} reference strings in raw mode', () => {
    const tokens = tokensOf(
      JSON.stringify({
        color: { brand: { $value: '{color.primary}' } },
      })
    )
    const serialized = serializeTokens(tokens)
    const tree = JSON.parse(serialized)
    expect(tree.color.brand.$value).toBe('{color.primary}')
  })

  // ---------------------------------------------------------------
  // 3. Resolved mode emits literals instead of references
  // ---------------------------------------------------------------
  it('emits resolved literals when value option is resolved', () => {
    const tokens = tokensOf(
      JSON.stringify({
        color: {
          primary: { $value: '#00ff00', $type: 'color' },
          alias: { $value: '{color.primary}', $type: 'color' },
        },
      })
    )
    const resolved: ResolvedTokenMap = resolve(tokens)
    const serialized = serializeTokens(resolved, { value: 'resolved' })
    const tree = JSON.parse(serialized)

    // Literal token stays the same
    expect(tree.color.primary.$value).toBe('#00ff00')
    // Alias is replaced by the resolved literal
    expect(tree.color.alias.$value).toBe('#00ff00')
  })

  // ---------------------------------------------------------------
  // 4. Nested groups: segments produce the right tree depth
  // ---------------------------------------------------------------
  it('builds correct nested groups from token segments', () => {
    const tokens = tokensOf(
      JSON.stringify({
        color: { surface: { primary: { $value: '#fff', $type: 'color' } } },
      })
    )
    const serialized = serializeTokens(tokens)
    const tree = JSON.parse(serialized)

    expect(tree).toHaveProperty('color')
    expect(tree.color).toHaveProperty('surface')
    expect(tree.color.surface).toHaveProperty('primary')
    expect(tree.color.surface.primary.$value).toBe('#fff')
    expect(tree.color.surface.primary.$type).toBe('color')
  })

  // ---------------------------------------------------------------
  // 5. Omits absent $type and $description
  // ---------------------------------------------------------------
  it('omits $type and $description when not present on the token', () => {
    const tokens = tokensOf(
      JSON.stringify({
        misc: { bare: { $value: 'hello' } },
      })
    )
    const serialized = serializeTokens(tokens)
    const tree = JSON.parse(serialized)

    expect(tree.misc.bare.$value).toBe('hello')
    expect(tree.misc.bare.$type).toBeUndefined()
    expect(tree.misc.bare.$description).toBeUndefined()
    expect(Object.keys(tree.misc.bare)).toEqual(['$value'])
  })

  // ---------------------------------------------------------------
  // 6. originalCssValue is never emitted
  // ---------------------------------------------------------------
  it('does not emit originalCssValue (renderer metadata)', () => {
    const tokens = tokensOf(
      JSON.stringify({
        shadow: {
          sm: { $value: '0 1px 3px rgba(0,0,0,0.1)', $type: 'shadow' },
        },
      })
    )
    // Simulate the CSS importer having set originalCssValue
    const token = tokens.get('shadow.sm')
    if (token !== undefined) {
      token.originalCssValue = '0 1px 3px rgba(0,0,0,0.1)'
    }

    const serialized = serializeTokens(tokens)
    expect(serialized).not.toContain('originalCssValue')

    const tree = JSON.parse(serialized)
    expect(Object.keys(tree.shadow.sm)).toEqual(
      expect.arrayContaining(['$value', '$type'])
    )
    expect(Object.keys(tree.shadow.sm)).not.toContain('originalCssValue')
  })

  // ---------------------------------------------------------------
  // 7. CSS converter case: parseCss → serialize → valid DTCG JSON
  // ---------------------------------------------------------------
  it('serializes CSS-sourced tokens into valid parseable DTCG JSON', () => {
    const css = `:root {
      --color-accent: #6366f1;
      --space-md: 16px;
    }`
    const { tokens, issues } = parseCss('theme.css', css)
    expect(issues).toEqual([])
    expect(tokens.size).toBeGreaterThan(0)

    const serialized = serializeTokens(tokens)
    // Must be valid JSON
    const tree = JSON.parse(serialized)
    expect(tree).toBeTruthy()

    // Must re-parse cleanly as DTCG
    const reparsed = parseFiles([file('from-css.json', serialized)])
    expect(reparsed.issues).toEqual([])

    // Paths should round-trip
    for (const path of tokens.keys()) {
      expect(reparsed.tokens.has(path)).toBe(true)
    }
  })

  // ---------------------------------------------------------------
  // 8. Deterministic key order regardless of insertion order
  // ---------------------------------------------------------------
  it('produces identical output regardless of map insertion order', () => {
    const json = JSON.stringify({
      zulu: { $value: 'last', $type: 'color' },
      alpha: { $value: 'first', $type: 'color' },
      charlie: { $value: 'mid', $type: 'color' },
    })
    const tokens = tokensOf(json)

    // Forward iteration
    const output1 = serializeTokens(tokens)

    // Reverse insertion order — delete all, re-insert in reverse key order
    const reversed = new Map(tokens)
    reversed.clear()
    const keys = [...tokens.keys()].reverse()
    for (const key of keys) {
      const value = tokens.get(key)
      if (value !== undefined) reversed.set(key, value)
    }

    const output2 = serializeTokens(reversed)
    expect(output1).toBe(output2)

    // Also verify keys are sorted alphabetically in the output
    const tree = JSON.parse(output1)
    const outputKeys = Object.keys(tree)
    expect(outputKeys).toEqual(['alpha', 'charlie', 'zulu'])
  })

  // ---------------------------------------------------------------
  // 9. Empty map → "{}" (no crash)
  // ---------------------------------------------------------------
  it('returns a valid empty object for an empty token map', () => {
    const output = serializeTokens(new Map())
    const tree = JSON.parse(output)
    expect(tree).toEqual({})
    // Trailing newline
    expect(output.endsWith('\n')).toBe(true)
  })
})
