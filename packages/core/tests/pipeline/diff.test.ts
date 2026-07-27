import { describe, expect, it } from 'vitest'
import { diff } from '@/pipeline/diff'
import { parseFiles } from '@/pipeline/parse'
import { resolve } from '@/pipeline/resolve'
import type { InputFile } from '@/pipeline/parse'
import type { ResolvedTokenMap } from '@/types/token'

/**
 * Build a resolved token map from raw DTCG JSON. Each argument becomes one
 * file (multiple files merge into one set, mirroring real usage).
 */
function resolvedOf(...json: string[]): ResolvedTokenMap {
  const files: InputFile[] = json.map((content, i) => ({
    name: `test-${i}.json`,
    content,
  }))
  return resolve(parseFiles(files).tokens)
}

/** Shorthand: pick only the matching/changed/missing/extra paths from a diff. */
function bucketPaths(
  result: ReturnType<typeof diff>,
  bucket: 'matching' | 'changed' | 'missing' | 'extra'
): string[] {
  return result[bucket].map((t) => t.path)
}

describe('diff', () => {
  /* ------------------------------ Empty inputs ----------------------------- */
  it('returns all-empty buckets for two empty maps', () => {
    const result = diff(new Map(), new Map())
    expect(result.matching).toEqual([])
    expect(result.changed).toEqual([])
    expect(result.missing).toEqual([])
    expect(result.extra).toEqual([])
  })

  /* -------------------------------- Matching ------------------------------- */
  it('classifies identical literal tokens as matching', () => {
    const a = resolvedOf(
      JSON.stringify({ color: { red: { $value: '#ff0000', $type: 'color' } } })
    )
    const b = resolvedOf(
      JSON.stringify({ color: { red: { $value: '#ff0000', $type: 'color' } } })
    )

    const result = diff(a, b)
    expect(bucketPaths(result, 'matching')).toEqual(['color.red'])
    expect(result.matching[0]?.a?.resolvedValue).toBe('#ff0000')
    expect(result.matching[0]?.b?.resolvedValue).toBe('#ff0000')
  })

  it('classifies tokens as matching when an alias in A equals a literal in B', () => {
    // The headline requirement: comparison is by RESOLVED value.
    // A aliases the literal via {color.base}; B has the literal directly.
    // Both resolve to #ff0000 → matching.
    const a = resolvedOf(
      JSON.stringify({
        color: {
          base: { $value: '#ff0000', $type: 'color' },
          primary: { $value: '{color.base}', $type: 'color' },
        },
      })
    )
    const b = resolvedOf(
      JSON.stringify({ color: { primary: { $value: '#ff0000', $type: 'color' } } })
    )

    const result = diff(a, b)
    expect(bucketPaths(result, 'matching')).toContain('color.primary')
    expect(bucketPaths(result, 'changed')).not.toContain('color.primary')
  })

  it('classifies tokens as matching when both sides alias to the same literal', () => {
    const a = resolvedOf(
      JSON.stringify({
        color: {
          base: { $value: '#00ff00', $type: 'color' },
          alias: { $value: '{color.base}', $type: 'color' },
        },
      })
    )
    const b = resolvedOf(
      JSON.stringify({
        color: {
          source: { $value: '#00ff00', $type: 'color' },
          alias: { $value: '{color.source}', $type: 'color' },
        },
      })
    )
    // color.alias in both → both resolve to #00ff00 → matching.
    expect(bucketPaths(diff(a, b), 'matching')).toContain('color.alias')
  })

  it('classifies matching typography tokens by deep composite equality', () => {
    const value = {
      fontFamily: 'Inter',
      fontSize: '16px',
      fontWeight: '700',
      lineHeight: '1.5',
    }
    const a = resolvedOf(
      JSON.stringify({ type: { body: { $type: 'typography', $value: value } } })
    )
    const b = resolvedOf(
      JSON.stringify({ type: { body: { $type: 'typography', $value: value } } })
    )
    expect(bucketPaths(diff(a, b), 'matching')).toEqual(['type.body'])
  })

  /* -------------------------------- Changed -------------------------------- */
  it('classifies tokens as changed when resolved literal values differ', () => {
    const a = resolvedOf(
      JSON.stringify({ color: { red: { $value: '#ff0000', $type: 'color' } } })
    )
    const b = resolvedOf(
      JSON.stringify({ color: { red: { $value: '#cc0000', $type: 'color' } } })
    )
    const result = diff(a, b)
    expect(bucketPaths(result, 'changed')).toEqual(['color.red'])
    expect(result.changed[0]?.a?.resolvedValue).toBe('#ff0000')
    expect(result.changed[0]?.b?.resolvedValue).toBe('#cc0000')
  })

  it('classifies as changed when an alias resolves to a different literal than B', () => {
    // A's alias resolves to #ff0000, B has the literal #00ff00 → changed.
    const a = resolvedOf(
      JSON.stringify({
        color: {
          base: { $value: '#ff0000', $type: 'color' },
          primary: { $value: '{color.base}', $type: 'color' },
        },
      })
    )
    const b = resolvedOf(
      JSON.stringify({ color: { primary: { $value: '#00ff00', $type: 'color' } } })
    )
    expect(bucketPaths(diff(a, b), 'changed')).toContain('color.primary')
  })

  it('classifies typography tokens as changed when one sub-field differs', () => {
    const a = resolvedOf(
      JSON.stringify({
        type: {
          body: {
            $type: 'typography',
            $value: { fontFamily: 'Inter', fontSize: '16px' },
          },
        },
      })
    )
    const b = resolvedOf(
      JSON.stringify({
        type: {
          body: {
            $type: 'typography',
            $value: { fontFamily: 'Inter', fontSize: '18px' },
          },
        },
      })
    )
    expect(bucketPaths(diff(a, b), 'changed')).toEqual(['type.body'])
  })

  it('does not match on string-vs-number ("42" is not 42)', () => {
    const a = resolvedOf(JSON.stringify({ n: { v: { $value: '42', $type: 'string' } } }))
    const b = resolvedOf(JSON.stringify({ n: { v: { $value: 42, $type: 'number' } } }))
    expect(bucketPaths(diff(a, b), 'changed')).toEqual(['n.v'])
  })

  /* -------------------------------- Missing -------------------------------- */
  it('classifies paths in A only as missing (from B)', () => {
    const a = resolvedOf(
      JSON.stringify({
        color: { red: { $value: '#ff0000', $type: 'color' } },
        space: { md: { $value: '16px', $type: 'dimension' } },
      })
    )
    const b = resolvedOf(
      JSON.stringify({ color: { red: { $value: '#ff0000', $type: 'color' } } })
    )
    const result = diff(a, b)
    expect(bucketPaths(result, 'missing')).toEqual(['space.md'])
    expect(result.missing[0]?.a).toBeDefined()
    expect(result.missing[0]?.b).toBeUndefined()
  })

  /* --------------------------------- Extra --------------------------------- */
  it('classifies paths in B only as extra (in B)', () => {
    const a = resolvedOf(
      JSON.stringify({ color: { red: { $value: '#ff0000', $type: 'color' } } })
    )
    const b = resolvedOf(
      JSON.stringify({
        color: { red: { $value: '#ff0000', $type: 'color' } },
        radius: { md: { $value: '8px', $type: 'dimension' } },
      })
    )
    const result = diff(a, b)
    expect(bucketPaths(result, 'extra')).toEqual(['radius.md'])
    expect(result.extra[0]?.a).toBeUndefined()
    expect(result.extra[0]?.b).toBeDefined()
  })

  /* ---------------------- Errored-resolution participation ----------------- */
  it('lets tokens with errored resolution participate using their raw form', () => {
    // Both sides have a dangling reference to the same nonexistent path.
    // Resolver keeps the raw "{color.x}" form on both → deep-equal → matching.
    const a = resolvedOf(
      JSON.stringify({ color: { alias: { $value: '{color.x}', $type: 'color' } } })
    )
    const b = resolvedOf(
      JSON.stringify({ color: { alias: { $value: '{color.x}', $type: 'color' } } })
    )
    expect(bucketPaths(diff(a, b), 'matching')).toEqual(['color.alias'])
  })

  it('classifies errored tokens as changed when their raw forms differ', () => {
    const a = resolvedOf(
      JSON.stringify({ color: { alias: { $value: '{color.x}', $type: 'color' } } })
    )
    const b = resolvedOf(
      JSON.stringify({ color: { alias: { $value: '{color.y}', $type: 'color' } } })
    )
    expect(bucketPaths(diff(a, b), 'changed')).toEqual(['color.alias'])
  })

  /* ------------------------------ Mixed scenario --------------------------- */
  it('partitions a realistic mixed set into all four buckets', () => {
    const a = resolvedOf(
      JSON.stringify({
        color: {
          shared: { $value: '#000', $type: 'color' }, // matching
          drift: { $value: '#aaa', $type: 'color' }, // changed
          onlyA: { $value: '#111', $type: 'color' }, // missing
        },
      })
    )
    const b = resolvedOf(
      JSON.stringify({
        color: {
          shared: { $value: '#000', $type: 'color' }, // matching
          drift: { $value: '#bbb', $type: 'color' }, // changed
          onlyB: { $value: '#222', $type: 'color' }, // extra
        },
      })
    )

    const result = diff(a, b)
    expect(bucketPaths(result, 'matching')).toEqual(['color.shared'])
    expect(bucketPaths(result, 'changed')).toEqual(['color.drift'])
    expect(bucketPaths(result, 'missing')).toEqual(['color.onlyA'])
    expect(bucketPaths(result, 'extra')).toEqual(['color.onlyB'])
  })

  /* --------------------------- Output stability ---------------------------- */
  it('sorts each bucket by path for deterministic output', () => {
    // Insert in reverse alphabetical order; expect sorted output.
    const a = resolvedOf(
      JSON.stringify({
        z: { $value: '1', $type: 'number' },
        a: { $value: '2', $type: 'number' },
        m: { $value: '3', $type: 'number' },
      })
    )
    const b = resolvedOf(
      JSON.stringify({
        z: { $value: '1', $type: 'number' },
        a: { $value: '2', $type: 'number' },
        m: { $value: '3', $type: 'number' },
      })
    )
    expect(bucketPaths(diff(a, b), 'matching')).toEqual(['a', 'm', 'z'])
  })

  it('preserves the a and b token references on each TokenDiff', () => {
    const a = resolvedOf(
      JSON.stringify({ color: { red: { $value: '#ff0000', $type: 'color' } } })
    )
    const b = resolvedOf(
      JSON.stringify({ color: { red: { $value: '#cc0000', $type: 'color' } } })
    )
    const changed = diff(a, b).changed[0]
    expect(changed?.a?.path).toBe('color.red')
    expect(changed?.b?.path).toBe('color.red')
    expect(changed?.a?.resolvedValue).toBe('#ff0000')
    expect(changed?.b?.resolvedValue).toBe('#cc0000')
  })
})
