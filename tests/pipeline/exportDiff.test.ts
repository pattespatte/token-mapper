import { describe, expect, it } from 'vitest'
import { toJsonDiffReport, toMarkdownDiffReport } from '@/pipeline/exportDiff'
import type { DiffResult } from '@/types/diff'

/** Empty diff result for the empty-state tests. */
function emptyDiff(): DiffResult {
  return { matching: [], changed: [], missing: [], extra: [] }
}

const META = {
  setALabel: 'foundation.json',
  setBLabel: 'modified.json',
  generatedAt: new Date('2026-07-26T14:03:00.000Z'),
}

describe('toMarkdownDiffReport', () => {
  it('renders a valid H1 + zero-count summary for an empty diff', () => {
    const md = toMarkdownDiffReport(emptyDiff(), META)
    expect(md).toContain('# Diff: foundation.json vs modified.json')
    expect(md).toContain('_Generated 2026-07-26 14:03 UTC_')
    expect(md).toContain('**0** tokens compared — 0 matching · 0 changed · 0 missing in B · 0 extra in B.')
  })

  it('renders four sections in the documented order', () => {
    const md = toMarkdownDiffReport(emptyDiff(), META)
    const changedIdx = md.indexOf('## Changed')
    const missingIdx = md.indexOf('## Missing in B')
    const extraIdx = md.indexOf('## Extra in B')
    const matchingIdx = md.indexOf('## Matching')
    expect(changedIdx).toBeGreaterThan(-1)
    expect(missingIdx).toBeGreaterThan(changedIdx)
    expect(extraIdx).toBeGreaterThan(missingIdx)
    expect(matchingIdx).toBeGreaterThan(extraIdx)
  })

  it('lists changed paths with their explanation summaries', () => {
    const diff: DiffResult = {
      matching: [],
      changed: [
        {
          path: 'spacing.md',
          bucket: 'changed',
          explanation: { summary: '+4px' },
        },
        {
          path: 'color.accent',
          bucket: 'changed',
          explanation: { summary: 'Δ23' },
        },
      ],
      missing: [],
      extra: [],
    }
    const md = toMarkdownDiffReport(diff, META)
    expect(md).toContain('- `spacing.md` — `+4px`')
    expect(md).toContain('- `color.accent` — `Δ23`')
  })

  it('omits the summary suffix when explanation is missing', () => {
    const diff: DiffResult = {
      matching: [],
      changed: [{ path: 'x.y', bucket: 'changed' }],
      missing: [],
      extra: [],
    }
    const md = toMarkdownDiffReport(diff, META)
    expect(md).toContain('- `x.y`')
    expect(md).not.toContain('`x.y` —')
  })

  it('lists missing and extra paths without summaries', () => {
    const diff: DiffResult = {
      matching: [],
      changed: [],
      missing: [{ path: 'a.b', bucket: 'missing' }],
      extra: [{ path: 'c.d', bucket: 'extra' }],
    }
    const md = toMarkdownDiffReport(diff, META)
    expect(md).toContain('- `a.b`')
    expect(md).toContain('- `c.d`')
  })

  it('truncates the changed list at 50 entries with a trailer', () => {
    const changed = Array.from({ length: 60 }, (_, i) => ({
      path: `t.${i}`,
      bucket: 'changed' as const,
      explanation: { summary: `+${i}` },
    }))
    const diff: DiffResult = {
      matching: [],
      changed,
      missing: [],
      extra: [],
    }
    const md = toMarkdownDiffReport(diff, META)
    // First 50 entries present.
    expect(md).toContain('- `t.0` — `+0`')
    expect(md).toContain('- `t.49` — `+49`')
    // 51st onward absent from the list.
    expect(md).not.toContain('- `t.50`')
    // Trailer mentions the omitted count.
    expect(md).toContain('_… and 10 more changed tokens._')
  })

  it('collapses matching section to just a count, never listing paths', () => {
    const diff: DiffResult = {
      matching: [
        { path: 'same.one', bucket: 'matching' },
        { path: 'same.two', bucket: 'matching' },
      ],
      changed: [],
      missing: [],
      extra: [],
    }
    const md = toMarkdownDiffReport(diff, META)
    expect(md).toContain('_2 matching tokens (omitted from report)._')
    expect(md).not.toContain('same.one')
    expect(md).not.toContain('same.two')
  })

  it('uses singular "token" when total is 1', () => {
    const diff: DiffResult = {
      matching: [{ path: 'only', bucket: 'matching' }],
      changed: [],
      missing: [],
      extra: [],
    }
    const md = toMarkdownDiffReport(diff, META)
    expect(md).toContain('**1** token compared')
    expect(md).toContain('_1 matching token (omitted from report)._')
  })
})

describe('toJsonDiffReport', () => {
  it('round-trips through JSON.parse for an empty diff', () => {
    const json = toJsonDiffReport(emptyDiff(), META)
    const parsed = JSON.parse(json) // throws on invalid JSON
    expect(parsed.counts).toEqual({ matching: 0, changed: 0, missing: 0, extra: 0 })
  })

  it('includes the documented top-level shape', () => {
    const json = toJsonDiffReport(emptyDiff(), META)
    const parsed = JSON.parse(json)
    expect(parsed.generatedAt).toBe('2026-07-26T14:03:00.000Z')
    expect(parsed.setA).toBe('foundation.json')
    expect(parsed.setB).toBe('modified.json')
    expect(parsed.counts).toBeDefined()
    expect(Array.isArray(parsed.changed)).toBe(true)
    expect(Array.isArray(parsed.missing)).toBe(true)
    expect(Array.isArray(parsed.extra)).toBe(true)
  })

  it('includes per-token summary in the changed array', () => {
    const diff: DiffResult = {
      matching: [],
      changed: [
        { path: 'spacing.md', bucket: 'changed', explanation: { summary: '+4px' } },
        { path: 'noexpl', bucket: 'changed' },
      ],
      missing: [],
      extra: [],
    }
    const json = toJsonDiffReport(diff, META)
    const parsed = JSON.parse(json)
    expect(parsed.changed).toEqual([
      { path: 'spacing.md', summary: '+4px' },
      { path: 'noexpl', summary: null },
    ])
  })

  it('omits matching body but keeps the count', () => {
    const diff: DiffResult = {
      matching: [{ path: 'a', bucket: 'matching' }, { path: 'b', bucket: 'matching' }],
      changed: [],
      missing: [],
      extra: [],
    }
    const json = toJsonDiffReport(diff, META)
    const parsed = JSON.parse(json)
    expect(parsed.counts.matching).toBe(2)
    expect(parsed.matching).toBeUndefined()
  })

  it('renders missing and extra as path-only objects', () => {
    const diff: DiffResult = {
      matching: [],
      changed: [],
      missing: [{ path: 'm', bucket: 'missing' }],
      extra: [{ path: 'e', bucket: 'extra' }],
    }
    const json = toJsonDiffReport(diff, META)
    const parsed = JSON.parse(json)
    expect(parsed.missing).toEqual([{ path: 'm' }])
    expect(parsed.extra).toEqual([{ path: 'e' }])
  })
})
