import { describe, expect, it } from 'vitest'
import { explainDiff } from '@/pipeline/explainDiff'
import { parseFiles } from '@/pipeline/parse'
import { resolve } from '@/pipeline/resolve'
import type { InputFile } from '@/pipeline/parse'
import type { ResolvedToken, ResolvedTokenMap } from '@/types/token'

/**
 * Build a resolved token map from raw DTCG JSON. Mirrors the fixture style
 * in `tests/pipeline/diff.test.ts`.
 */
function resolvedOf(...json: string[]): ResolvedTokenMap {
  const files: InputFile[] = json.map((content, i) => ({
    name: `test-${i}.json`,
    content,
  }))
  return resolve(parseFiles(files).tokens)
}

/** Pull a single resolved token out of a map by path. */
function tokenAt(map: ResolvedTokenMap, path: string): ResolvedToken {
  const t = map.get(path)
  if (t === undefined) throw new Error(`no token at ${path}`)
  return t
}

/**
 * Build two single-token maps and return the two resolved tokens for diffing.
 * Convenience wrapper for the per-type tests below.
 */
function pairOf(
  aJson: string,
  bJson: string,
  path: string
): [ResolvedToken, ResolvedToken] {
  const a = tokenAt(resolvedOf(aJson), path)
  const b = tokenAt(resolvedOf(bJson), path)
  return [a, b]
}

describe('explainDiff — color', () => {
  it('computes RGB distance and qualitative label for two hex colors', () => {
    const [a, b] = pairOf(
      JSON.stringify({ c: { $type: 'color', $value: '#000000' } }),
      JSON.stringify({ c: { $type: 'color', $value: '#ffffff' } }),
      'c'
    )
    const e = explainDiff(a, b)
    // Max distance ≈ 441.67 → rounds to 442.
    expect(e.summary).toBe('Δ442')
    expect(e.details).toBeDefined()
    expect(e.details?.[0]).toEqual({ label: 'color', before: '#000000', after: '#ffffff' })
    expect(e.details?.[1]?.after).toMatch(/442 \(far\)/)
    expect(e.magnitude).toBeCloseTo(1, 1)
  })

  it('labels near-identical colors as "near"', () => {
    // #000000 vs #010101 — tiny delta.
    const [a, b] = pairOf(
      JSON.stringify({ c: { $type: 'color', $value: '#000000' } }),
      JSON.stringify({ c: { $type: 'color', $value: '#010101' } }),
      'c'
    )
    const e = explainDiff(a, b)
    expect(e.details?.[1]?.after).toContain('near')
  })

  it('labels medium-distance colors as "visible"', () => {
    // #000000 vs #0c0c0c — distance ≈ sqrt(3 × 12²) ≈ 20.8 (in the 5..25 visible band)
    const [a, b] = pairOf(
      JSON.stringify({ c: { $type: 'color', $value: '#000000' } }),
      JSON.stringify({ c: { $type: 'color', $value: '#0c0c0c' } }),
      'c'
    )
    const e = explainDiff(a, b)
    expect(e.details?.[1]?.after).toContain('visible')
  })

  it('falls back when color values are unparseable', () => {
    const [a, b] = pairOf(
      JSON.stringify({ c: { $type: 'color', $value: 'not-a-color' } }),
      JSON.stringify({ c: { $type: 'color', $value: 42 } }),
      'c'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toContain('→')
    expect(e.magnitude).toBeUndefined()
  })
})

describe('explainDiff — dimension', () => {
  it('shows delta with sign and unit, plus ratio', () => {
    const [a, b] = pairOf(
      JSON.stringify({ d: { $type: 'dimension', $value: '16px' } }),
      JSON.stringify({ d: { $type: 'dimension', $value: '20px' } }),
      'd'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('+4px')
    expect(e.details).toEqual([
      { label: 'value', before: '16px', after: '20px' },
      { label: 'delta', before: '', after: '+4px' },
      { label: 'ratio', before: '', after: '1.25×' },
    ])
  })

  it('handles negative deltas', () => {
    const [a, b] = pairOf(
      JSON.stringify({ d: { $type: 'dimension', $value: '20px' } }),
      JSON.stringify({ d: { $type: 'dimension', $value: '16px' } }),
      'd'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('-4px')
  })

  it('omits ratio when before is 0', () => {
    const [a, b] = pairOf(
      JSON.stringify({ d: { $type: 'dimension', $value: '0' } }),
      JSON.stringify({ d: { $type: 'dimension', $value: '8px' } }),
      'd'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('+8px')
    expect(e.details?.find((d) => d.label === 'ratio')).toBeUndefined()
  })

  it('falls back when values are not parseable lengths', () => {
    const [a, b] = pairOf(
      JSON.stringify({ d: { $type: 'dimension', $value: 'garbage' } }),
      JSON.stringify({ d: { $type: 'dimension', $value: 'more garbage' } }),
      'd'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toContain('→')
  })
})

describe('explainDiff — number', () => {
  it('computes numeric delta with sign and ratio', () => {
    const [a, b] = pairOf(
      JSON.stringify({ n: { $type: 'number', $value: 4 } }),
      JSON.stringify({ n: { $type: 'number', $value: 5 } }),
      'n'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('+1')
    expect(e.details?.find((d) => d.label === 'ratio')?.after).toBe('1.25×')
  })
})

describe('explainDiff — duration', () => {
  it('parses s/ms strings and computes numeric delta', () => {
    const [a, b] = pairOf(
      JSON.stringify({ d: { $type: 'duration', $value: '200ms' } }),
      JSON.stringify({ d: { $type: 'duration', $value: '300ms' } }),
      'd'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('+100')
    expect(e.details?.find((d) => d.label === 'value')).toEqual({
      label: 'value',
      before: '200ms',
      after: '300ms',
    })
  })
})

describe('explainDiff — typography', () => {
  it('lists changed sub-fields and counts them in summary', () => {
    const [a, b] = pairOf(
      JSON.stringify({
        t: {
          $type: 'typography',
          $value: { fontFamily: 'Inter', fontSize: '14px', fontWeight: 400 },
        },
      }),
      JSON.stringify({
        t: {
          $type: 'typography',
          $value: { fontFamily: 'Inter', fontSize: '16px', fontWeight: 500 },
        },
      }),
      't'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('2 fields')
    expect(e.details).toEqual([
      { label: 'fontSize', before: '14px', after: '16px' },
      { label: 'fontWeight', before: '400', after: '500' },
    ])
  })

  it('shows added and removed fields with markers', () => {
    const [a, b] = pairOf(
      JSON.stringify({
        t: {
          $type: 'typography',
          $value: { fontFamily: 'Inter', fontSize: '14px' },
        },
      }),
      JSON.stringify({
        t: {
          $type: 'typography',
          $value: { fontFamily: 'Inter', lineHeight: '1.5' },
        },
      }),
      't'
    )
    const e = explainDiff(a, b)
    // fontSize present in A only → before has value, after marked (removed)
    expect(e.details).toContainEqual({ label: 'fontSize', before: '14px', after: '(removed)' })
    // lineHeight present in B only → before marked (added), after has value
    expect(e.details).toContainEqual({ label: 'lineHeight', before: '(added)', after: '1.5' })
  })
})

describe('explainDiff — border', () => {
  it('lists changed border fields', () => {
    const [a, b] = pairOf(
      JSON.stringify({
        b: { $type: 'border', $value: { width: '1px', style: 'solid', color: '#000' } },
      }),
      JSON.stringify({
        b: { $type: 'border', $value: { width: '2px', style: 'solid', color: '#000' } },
      }),
      'b'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('1 field')
    expect(e.details).toEqual([{ label: 'width', before: '1px', after: '2px' }])
  })
})

describe('explainDiff — shadow', () => {
  it('compares single-layer shadows field-by-field', () => {
    const [a, b] = pairOf(
      JSON.stringify({
        s: {
          $type: 'shadow',
          $value: { offsetX: '0', offsetY: '1px', blur: '2px', color: '#000' },
        },
      }),
      JSON.stringify({
        s: {
          $type: 'shadow',
          $value: { offsetX: '0', offsetY: '4px', blur: '6px', color: '#000' },
        },
      }),
      's'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('2 fields')
    expect(e.details).toContainEqual({ label: 'offsetY', before: '1px', after: '4px' })
    expect(e.details).toContainEqual({ label: 'blur', before: '2px', after: '6px' })
  })

  it('compares multi-layer shadows and prefixes field labels with layer index', () => {
    const [a, b] = pairOf(
      JSON.stringify({
        s: {
          $type: 'shadow',
          $value: [
            { offsetX: '0', offsetY: '0', color: '#fff' },
            { offsetX: '0', offsetY: '0', color: '#000' },
          ],
        },
      }),
      JSON.stringify({
        s: {
          $type: 'shadow',
          $value: [
            { offsetX: '0', offsetY: '0', color: '#eee' },
            { offsetX: '0', offsetY: '0', color: '#000' },
          ],
        },
      }),
      's'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('1 field')
    expect(e.details).toContainEqual({ label: 'L1 color', before: '#fff', after: '#eee' })
  })

  it('reports layer count delta when arrays differ in length', () => {
    const [a, b] = pairOf(
      JSON.stringify({
        s: { $type: 'shadow', $value: [{ offsetX: '0', offsetY: '0', color: '#000' }] },
      }),
      JSON.stringify({
        s: {
          $type: 'shadow',
          $value: [
            { offsetX: '0', offsetY: '0', color: '#000' },
            { offsetX: '0', offsetY: '0', color: '#fff' },
          ],
        },
      }),
      's'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('1→2 layers')
    expect(e.details).toContainEqual({ label: 'layers', before: '1', after: '2' })
  })
})

describe('explainDiff — gradient', () => {
  it('compares gradient stops color and position', () => {
    const [a, b] = pairOf(
      JSON.stringify({
        g: {
          $type: 'gradient',
          $value: [
            { color: '#ff0000', position: '0%' },
            { color: '#0000ff', position: '100%' },
          ],
        },
      }),
      JSON.stringify({
        g: {
          $type: 'gradient',
          $value: [
            { color: '#ff0000', position: '0%' },
            { color: '#00ff00', position: '100%' },
          ],
        },
      }),
      'g'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('1 field')
    expect(e.details).toContainEqual({
      label: 'S2 color',
      before: '#0000ff',
      after: '#00ff00',
    })
  })

  it('handles wrapping { type, angle, stops } object with multi-stop prefix', () => {
    const [a, b] = pairOf(
      JSON.stringify({
        g: {
          $type: 'gradient',
          $value: {
            type: 'linear',
            angle: '90deg',
            stops: [
              { color: '#000', position: '0%' },
              { color: '#fff', position: '100%' },
            ],
          },
        },
      }),
      JSON.stringify({
        g: {
          $type: 'gradient',
          $value: {
            type: 'linear',
            angle: '90deg',
            stops: [
              { color: '#888', position: '0%' },
              { color: '#fff', position: '100%' },
            ],
          },
        },
      }),
      'g'
    )
    const e = explainDiff(a, b)
    expect(e.details).toContainEqual({ label: 'S1 color', before: '#000', after: '#888' })
  })
})

describe('explainDiff — type mismatch and fallback', () => {
  it('reports "type changed" when types differ', () => {
    const [a, b] = pairOf(
      JSON.stringify({ x: { $type: 'color', $value: '#000' } }),
      JSON.stringify({ x: { $type: 'dimension', $value: '10px' } }),
      'x'
    )
    const e = explainDiff(a, b)
    expect(e.summary).toBe('type changed')
    expect(e.details).toEqual([{ label: 'type', before: 'color', after: 'dimension' }])
  })

  it('uses JSON before/after fallback for unknown types', () => {
    const [a, b] = pairOf(
      JSON.stringify({ x: { $type: 'mystery', $value: 'before' } }),
      JSON.stringify({ x: { $type: 'mystery', $value: 'after' } }),
      'x'
    )
    const e = explainDiff(a, b)
    // formatValue returns string primitives as-is (no quotes); objects would JSON-stringify.
    expect(e.summary).toBe('before → after')
    expect(e.details).toEqual([{ label: 'value', before: 'before', after: 'after' }])
  })

  it('truncates long fallback summaries', () => {
    const longA = 'a'.repeat(50)
    const longB = 'b'.repeat(50)
    const [a, b] = pairOf(
      JSON.stringify({ x: { $type: 'mystery', $value: longA } }),
      JSON.stringify({ x: { $type: 'mystery', $value: longB } }),
      'x'
    )
    const e = explainDiff(a, b)
    // Each side truncated to 30 chars (29 + ellipsis).
    expect(e.summary.length).toBeLessThan(70)
    expect(e.summary).toContain('…')
  })

  it('never throws — falls back on any unexpected error', () => {
    // Construct tokens with deliberately weird resolved values.
    const aMap = resolvedOf(JSON.stringify({ x: { $type: 'color', $value: '#000' } }))
    const bMap = resolvedOf(JSON.stringify({ x: { $type: 'color', $value: '#fff' } }))
    const a = tokenAt(aMap, 'x')
    const b = tokenAt(bMap, 'x')
    // Corrupt resolvedValue to force the color branch into unusual paths.
    ;(a as { resolvedValue: unknown }).resolvedValue = { weird: 'object' }
    ;(b as { resolvedValue: unknown }).resolvedValue = { different: 'object' }
    expect(() => explainDiff(a, b)).not.toThrow()
  })
})
