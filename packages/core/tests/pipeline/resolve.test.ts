import { describe, expect, it } from 'vitest'
import { parseFiles } from '@/pipeline/parse'
import { resolve } from '@/pipeline/resolve'
import type { InputFile } from '@/pipeline/parse'
import type { ResolvedToken, TokenMap } from '@/types/token'

/** Parse raw DTCG JSON into a TokenMap. */
function tokensOf(...json: string[]): TokenMap {
  const files: InputFile[] = json.map((content, i) => ({
    name: `test-${i}.json`,
    content,
  }))
  return parseFiles(files).tokens
}

describe('resolve', () => {
  it('returns a literal value unchanged with an empty alias chain', () => {
    const tokens = tokensOf(
      JSON.stringify({ color: { red: { $value: '#ff0000', $type: 'color' } } })
    )
    const resolved = resolve(tokens).get('color.red') as ResolvedToken

    expect(resolved.resolvedValue).toBe('#ff0000')
    expect(resolved.rawValue).toBe('#ff0000')
    expect(resolved.aliasChain).toEqual([])
    expect(resolved.hasError).toBe(false)
  })

  it('resolves a single-hop alias to the literal target value', () => {
    const tokens = tokensOf(
      JSON.stringify({
        color: {
          base: { $value: '#ff0000', $type: 'color' },
          alias: { $value: '{color.base}', $type: 'color' },
        },
      })
    )
    const resolved = resolve(tokens).get('color.alias') as ResolvedToken

    expect(resolved.resolvedValue).toBe('#ff0000')
    expect(resolved.rawValue).toBe('{color.base}')
    expect(resolved.aliasChain).toHaveLength(1)
    expect(resolved.aliasChain[0]?.path).toBe('color.base')
    expect(resolved.aliasChain[0]?.raw).toBe('{color.base}')
    expect(resolved.aliasChain[0]?.resolved).toBe('#ff0000')
    expect(resolved.hasError).toBe(false)
  })

  it('resolves a multi-hop chain, recording every hop', () => {
    // a → b → literal
    const tokens = tokensOf(
      JSON.stringify({
        a: { x: { $value: '{b.x}', $type: 'color' } },
        b: { x: { $value: '{c.x}', $type: 'color' } },
        c: { x: { $value: '#00ff00', $type: 'color' } },
      })
    )
    const resolved = resolve(tokens).get('a.x') as ResolvedToken

    expect(resolved.resolvedValue).toBe('#00ff00')
    expect(resolved.aliasChain).toHaveLength(2)
    expect(resolved.aliasChain[0]?.path).toBe('b.x')
    expect(resolved.aliasChain[1]?.path).toBe('c.x')
    expect(resolved.aliasChain[1]?.resolved).toBe('#00ff00')
    expect(resolved.hasError).toBe(false)
  })

  it('resolves chains that cross multiple files (foundation + semantic)', () => {
    // Mirrors the real DS shape: semantic.json aliases a primitive in
    // foundation.json. The parser merges them; the resolver follows across.
    const tokens = tokensOf(
      JSON.stringify({
        color: { pink: { 900: { $value: '#3d0414', $type: 'color' } } },
      }),
      JSON.stringify({
        color: {
          surface: {
            primary: { default: { $value: '{color.pink.900}', $type: 'color' } },
          },
        },
      })
    )
    const resolved = resolve(tokens).get(
      'color.surface.primary.default'
    ) as ResolvedToken

    expect(resolved.resolvedValue).toBe('#3d0414')
    expect(resolved.rawValue).toBe('{color.pink.900}')
    expect(resolved.aliasChain).toHaveLength(1)
    expect(resolved.aliasChain[0]?.resolved).toBe('#3d0414')
    expect(resolved.hasError).toBe(false)
  })

  /* ------------------------------ Cycle handling --------------------------- */

  it('handles a cycle without infinite-looping, marking hasError', () => {
    const tokens = tokensOf(
      JSON.stringify({
        a: { x: { $value: '{b.x}', $type: 'color' } },
        b: { x: { $value: '{a.x}', $type: 'color' } },
      })
    )
    // If this returns at all, we didn't infinite-loop.
    const a = resolve(tokens).get('a.x') as ResolvedToken
    const b = resolve(tokens).get('b.x') as ResolvedToken

    expect(a.hasError).toBe(true)
    expect(b.hasError).toBe(true)
    // On a cycle, the resolved value falls back to the raw reference form of
    // the target that would have re-entered the cycle — the most diagnostically
    // useful "where it broke" signal. Either way the UI still renders something.
    expect(a.resolvedValue).toBe('{a.x}')
  })

  it('handles a self-cycle {a} → {a}', () => {
    const tokens = tokensOf(
      JSON.stringify({ a: { x: { $value: '{a.x}', $type: 'color' } } })
    )
    const a = resolve(tokens).get('a.x') as ResolvedToken
    expect(a.hasError).toBe(true)
    expect(a.resolvedValue).toBe('{a.x}')
  })

  it('handles a 3-token cycle {a} → {b} → {c} → {a}', () => {
    const tokens = tokensOf(
      JSON.stringify({
        a: { x: { $value: '{b.x}', $type: 'color' } },
        b: { x: { $value: '{c.x}', $type: 'color' } },
        c: { x: { $value: '{a.x}', $type: 'color' } },
      })
    )
    const a = resolve(tokens).get('a.x') as ResolvedToken
    expect(a.hasError).toBe(true)
  })

  /* --------------------------- Dangling reference -------------------------- */

  it('marks a dangling reference as errored and keeps the raw form', () => {
    const tokens = tokensOf(
      JSON.stringify({
        color: { alias: { $value: '{color.missing}', $type: 'color' } },
      })
    )
    const resolved = resolve(tokens).get('color.alias') as ResolvedToken

    expect(resolved.hasError).toBe(true)
    expect(resolved.resolvedValue).toBe('{color.missing}') // raw preserved
    expect(resolved.aliasChain).toHaveLength(1)
    expect(resolved.aliasChain[0]?.path).toBe('color.missing')
    expect(resolved.aliasChain[0]?.resolved).toBeUndefined()
  })

  /* ----------------------------- Composite values -------------------------- */

  it('resolves references inside a composite typography value, preserving shape', () => {
    // fontFamily aliases a primitive; fontSize is a literal. Both must end up
    // in resolvedValue, fontFamily resolved and fontSize unchanged.
    const tokens = tokensOf(
      JSON.stringify({
        font: { sans: { $value: 'Inter', $type: 'fontFamily' } },
        type: {
          body: {
            $type: 'typography',
            $value: {
              fontFamily: '{font.sans}',
              fontSize: '16px',
              fontWeight: '400',
            },
          },
        },
      })
    )
    const resolved = resolve(tokens).get('type.body') as ResolvedToken

    expect(resolved.resolvedValue).toEqual({
      fontFamily: 'Inter',
      fontSize: '16px',
      fontWeight: '400',
    })
    expect(resolved.rawValue).toEqual({
      fontFamily: '{font.sans}',
      fontSize: '16px',
      fontWeight: '400',
    })
    expect(resolved.hasError).toBe(false)
  })

  it('populates aliasChain for composite values (regression: previously empty)', () => {
    // Regression test: until the resolve fix, composite (typography, shadow,
    // etc.) values always got an empty aliasChain because the array/object
    // branches recursed with a fresh chain and discarded the sub-hops. The
    // Inspector's "Reference chain" section silently wouldn't render.
    const tokens = tokensOf(
      JSON.stringify({
        font: { sans: { $value: 'Inter', $type: 'fontFamily' } },
        type: {
          body: {
            $type: 'typography',
            $value: { fontFamily: '{font.sans}', fontSize: '16px' },
          },
        },
      })
    )
    const resolved = resolve(tokens).get('type.body') as ResolvedToken

    // The fontFamily hop must now be present on the composite's chain.
    expect(resolved.aliasChain).toHaveLength(1)
    expect(resolved.aliasChain[0]?.path).toBe('font.sans')
    expect(resolved.aliasChain[0]?.raw).toBe('{font.sans}')
    expect(resolved.aliasChain[0]?.resolved).toBe('Inter')
  })

  it('aggregates aliasChain across multiple sub-references in a composite', () => {
    // Two internal references — both hops should land in the aggregate chain.
    const tokens = tokensOf(
      JSON.stringify({
        font: { sans: { $value: 'Inter', $type: 'fontFamily' } },
        size: { md: { $value: '16px', $type: 'dimension' } },
        type: {
          body: {
            $type: 'typography',
            $value: { fontFamily: '{font.sans}', fontSize: '{size.md}' },
          },
        },
      })
    )
    const resolved = resolve(tokens).get('type.body') as ResolvedToken

    expect(resolved.aliasChain).toHaveLength(2)
    const paths = resolved.aliasChain.map((h) => h.path).sort()
    expect(paths).toEqual(['font.sans', 'size.md'])
  })

  it('flags hasError when a composite value has a dangling sub-reference', () => {
    const tokens = tokensOf(
      JSON.stringify({
        type: {
          x: {
            $type: 'typography',
            $value: { fontFamily: '{font.missing}', fontSize: '16px' },
          },
        },
      })
    )
    const resolved = resolve(tokens).get('type.x') as ResolvedToken
    expect(resolved.hasError).toBe(true)
    // The dangling sub-ref keeps its raw form; the literal sub-field survives.
    expect(resolved.resolvedValue).toEqual({
      fontFamily: '{font.missing}',
      fontSize: '16px',
    })
  })

  it('resolves references inside arrays (e.g. multi-layer shadows)', () => {
    const tokens = tokensOf(
      JSON.stringify({
        color: { shadow: { $value: '#00000050', $type: 'color' } },
        shadow: {
          lg: {
            $type: 'shadow',
            $value: [
              { color: '{color.shadow}', x: '0', y: '4px', blur: '8px' },
              { color: '#00000020', x: '0', y: '2px', blur: '4px' },
            ],
          },
        },
      })
    )
    const resolved = resolve(tokens).get('shadow.lg') as ResolvedToken

    expect(resolved.hasError).toBe(false)
    expect(Array.isArray(resolved.resolvedValue)).toBe(true)
    const layers = resolved.resolvedValue as Array<{
      color: string
      x: string
      y: string
      blur: string
    }>
    expect(layers[0]?.color).toBe('#00000050') // resolved
    expect(layers[1]?.color).toBe('#00000020') // literal
  })

  /* ----------------------- Partial references (embedded) ----------------------- */
  /* A `{...}` fragment inside a larger literal string. The resolver splices   */
  /* the target value into the string and records one hop per fragment.        */

  it('splices a single embedded reference into the surrounding string', () => {
    const tokens = tokensOf(
      JSON.stringify({
        color: { border: { $value: '#ccc', $type: 'color' } },
        border: { default: { $value: '1px solid {color.border}', $type: 'border' } },
      })
    )
    const t = resolve(tokens).get('border.default') as ResolvedToken
    expect(t.resolvedValue).toBe('1px solid #ccc')
    expect(t.aliasChain).toHaveLength(1)
    expect(t.aliasChain[0]?.path).toBe('color.border')
    expect(t.aliasChain[0]?.resolved).toBe('#ccc')
    expect(t.hasError).toBe(false)
  })

  it('splices multiple embedded references in one string', () => {
    const tokens = tokensOf(
      JSON.stringify({
        c1: { $value: '#fff', $type: 'color' },
        c2: { $value: '#000', $type: 'color' },
        grad: { $value: 'linear-gradient({c1}, {c2})' },
      })
    )
    const t = resolve(tokens).get('grad') as ResolvedToken
    expect(t.resolvedValue).toBe('linear-gradient(#fff, #000)')
    expect(t.aliasChain).toHaveLength(2)
    expect(t.hasError).toBe(false)
  })

  it('leaves a dangling embedded reference in place and flags hasError', () => {
    const tokens = tokensOf(
      JSON.stringify({
        border: { default: { $value: '1px solid {color.missing}' } },
      })
    )
    const t = resolve(tokens).get('border.default') as ResolvedToken
    // The fragment stays as {color.missing} so the UI shows what broke.
    expect(t.resolvedValue).toBe('1px solid {color.missing}')
    expect(t.aliasChain).toHaveLength(1)
    expect(t.aliasChain[0]?.resolved).toBeUndefined()
    expect(t.hasError).toBe(true)
  })

  it('detects a cycle through an embedded reference', () => {
    // a → 'x {b}'; b → 'y {a}'  (cycle through the embedded refs)
    const tokens = tokensOf(
      JSON.stringify({
        a: { $value: 'x {b}' },
        b: { $value: 'y {a}' },
      })
    )
    const a = resolve(tokens).get('a') as ResolvedToken
    expect(a.hasError).toBe(true)
    // The fragment that cycles stays as {b}; 'x ' literal survives.
    expect(typeof a.resolvedValue).toBe('string')
  })

  it('treats a pure literal (no embedded refs) exactly as before', () => {
    const tokens = tokensOf(
      JSON.stringify({
        s: { $value: 'just a literal string', $type: 'string' },
      })
    )
    const t = resolve(tokens).get('s') as ResolvedToken
    expect(t.resolvedValue).toBe('just a literal string')
    expect(t.aliasChain).toEqual([])
    expect(t.hasError).toBe(false)
  })

  /* ------------------------------ Edge cases ------------------------------ */

  it('preserves numeric and boolean literal values', () => {
    const tokens = tokensOf(
      JSON.stringify({
        n: { v: { $value: 42, $type: 'number' } },
        b: { v: { $value: true, $type: 'boolean' } },
      })
    )
    const n = resolve(tokens).get('n.v') as ResolvedToken
    const b = resolve(tokens).get('b.v') as ResolvedToken
    expect(n.resolvedValue).toBe(42)
    expect(b.resolvedValue).toBe(true)
    expect(n.aliasChain).toEqual([])
    expect(b.aliasChain).toEqual([])
  })

  it('handles an empty token map', () => {
    const tokens = tokensOf(JSON.stringify({}))
    expect(resolve(tokens).size).toBe(0)
  })

  it('returns one entry per input token', () => {
    const tokens = tokensOf(
      JSON.stringify({
        a: { x: { $value: '#fff', $type: 'color' } },
        b: { y: { $value: '16px', $type: 'dimension' } },
        c: { z: { $value: '{a.x}', $type: 'color' } },
      })
    )
    const resolved = resolve(tokens)
    expect(resolved.size).toBe(tokens.size)
    for (const path of tokens.keys()) {
      expect(resolved.has(path)).toBe(true)
    }
  })
})
