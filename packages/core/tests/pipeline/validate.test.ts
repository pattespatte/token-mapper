import { describe, expect, it } from 'vitest'
import { validate } from '@/pipeline/validate'
import { parseFiles } from '@/pipeline/parse'
import type { InputFile } from '@/pipeline/parse'
import type { TokenMap } from '@/types/token'

/** Parse raw DTCG JSON into a TokenMap for validation tests. */
function tokensOf(...json: string[]): { tokens: TokenMap; parseIssues: number } {
  const files: InputFile[] = json.map((content, i) => ({
    name: `test-${i}.json`,
    content,
  }))
  const result = parseFiles(files)
  return { tokens: result.tokens, parseIssues: result.issues.length }
}

/** Find the first issue with the given code (or undefined). */
function issueWithCode(
  issues: ReturnType<typeof validate>,
  code: string
): ReturnType<typeof validate>[number] | undefined {
  return issues.find((i) => i.code === code)
}

describe('validate', () => {
  it('produces zero issues for a clean, well-formed token set', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        color: {
          red: { $value: '#ff0000', $type: 'color' },
          blue: { $value: '#0000ff', $type: 'color' },
        },
        space: { md: { $value: '16px', $type: 'dimension' } },
      })
    )
    expect(validate(tokens)).toEqual([])
  })

  /* ------------------------------- MISSING_TYPE ----------------------------- */
  it('emits MISSING_TYPE warning when a token has no $type', () => {
    const { tokens } = tokensOf(
      JSON.stringify({ color: { red: { $value: '#ff0000' } } })
    )
    const issues = validate(tokens)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('MISSING_TYPE')
    expect(issues[0]?.severity).toBe('warning')
    expect(issues[0]?.path).toBe('color.red')
  })

  /* ------------------------------- UNKNOWN_TYPE ----------------------------- */
  it('emits UNKNOWN_TYPE warning for an unrecognised $type', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        custom: { thing: { $value: 'x', $type: 'magic' } },
      })
    )
    const issue = issueWithCode(validate(tokens), 'UNKNOWN_TYPE')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('warning')
  })

  it('does NOT emit UNKNOWN_TYPE for any W3C-defined type', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        a: {
          c: { $value: '#fff', $type: 'color' },
          d: { $value: '4px', $type: 'dimension' },
          ff: { $value: 'Inter', $type: 'fontFamily' },
          fw: { $value: 700, $type: 'fontWeight' },
          du: { $value: '200ms', $type: 'duration' },
          n: { $value: 42, $type: 'number' },
          cb: { $value: [0.4, 0, 0.2, 1], $type: 'cubicBezier' },
          ty: {
            $value: { fontFamily: 'Inter' },
            $type: 'typography',
          },
        },
      })
    )
    expect(issueWithCode(validate(tokens), 'UNKNOWN_TYPE')).toBeUndefined()
  })

  /* --------------------------- INVALID_VALUE_FOR_TYPE ----------------------- */
  it('emits INVALID_VALUE_FOR_TYPE when a color $value is not a color', () => {
    const { tokens } = tokensOf(
      JSON.stringify({ color: { x: { $value: 42, $type: 'color' } } })
    )
    const issue = issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')
    expect(issue).toBeDefined()
    expect(issue?.path).toBe('color.x')
  })

  it('accepts 6-digit hex for color', () => {
    const { tokens } = tokensOf(
      JSON.stringify({ color: { x: { $value: '#3d0414', $type: 'color' } } })
    )
    expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeUndefined()
  })

  it('accepts 8-digit alpha hex for color (CSS standard, alpha last)', () => {
    // The sample dataset uses this form for shadow colors: #0a0d120d
    const { tokens } = tokensOf(
      JSON.stringify({ color: { x: { $value: '#0a0d120d', $type: 'color' } } })
    )
    expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeUndefined()
  })

  it('accepts 3-digit hex shorthand for color', () => {
    const { tokens } = tokensOf(
      JSON.stringify({ color: { x: { $value: '#fff', $type: 'color' } } })
    )
    expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeUndefined()
  })

  it('accepts rgb()/hsl() strings for color', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        color: {
          r: { $value: 'rgb(255, 0, 0)', $type: 'color' },
          h: { $value: 'hsl(0, 100%, 50%)', $type: 'color' },
        },
      })
    )
    expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeUndefined()
  })

  it('Node fallback regex rejects obvious garbage the old regex accepted', () => {
    // jsdom provides CSS.supports so we'd normally hit the browser path.
    // Temporarily remove CSS to exercise the Node fallback regex and confirm
    // it rejects 'rgb(evil)' and friends — the audit's #5 finding.
    const originalCSS = (globalThis as { CSS?: unknown }).CSS
    // @ts-expect-error — intentionally deleting a global for the test.
    delete (globalThis as { CSS?: unknown }).CSS
    try {
      const { tokens } = tokensOf(
        JSON.stringify({
          color: {
            evil: { $value: 'rgb(evil)', $type: 'color' },
            junk: { $value: 'rgb(1, 2) /* xss */', $type: 'color' },
            notfn: { $value: 'notacolor', $type: 'color' },
          },
        })
      )
      const issues = validate(tokens)
      const invalid = issues.filter((i) => i.code === 'INVALID_VALUE_FOR_TYPE')
      expect(invalid).toHaveLength(3)
    } finally {
      ;(globalThis as { CSS?: unknown }).CSS = originalCSS
    }
  })

  it('Node fallback regex accepts common color function syntaxes', () => {
    const originalCSS = (globalThis as { CSS?: unknown }).CSS
    // @ts-expect-error — intentionally deleting a global for the test.
    delete (globalThis as { CSS?: unknown }).CSS
    try {
      const { tokens } = tokensOf(
        JSON.stringify({
          color: {
            a: { $value: 'rgb(99, 102, 241)', $type: 'color' },
            b: { $value: 'rgba(0, 0, 0, 0.5)', $type: 'color' },
            c: { $value: 'hsl(239, 84%, 67%)', $type: 'color' },
            d: { $value: 'oklch(0.5 0.2 240)', $type: 'color' },
            e: { $value: 'oklch(0.5 0.2 240 / 0.5)', $type: 'color' },
          },
        })
      )
      expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeUndefined()
    } finally {
      ;(globalThis as { CSS?: unknown }).CSS = originalCSS
    }
  })

  it('accepts the structured W3C draft color object', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        color: {
          x: {
            $type: 'color',
            $value: { colorSpace: 'srgb', components: [0.5, 0.6, 0.7], alpha: 0.8 },
          },
        },
      })
    )
    expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeUndefined()
  })

  it('accepts a dimension with various CSS length units', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        space: {
          a: { $value: '0', $type: 'dimension' },
          b: { $value: '4px', $type: 'dimension' },
          c: { $value: '1.5rem', $type: 'dimension' },
          d: { $value: '2em', $type: 'dimension' },
          e: { $value: '50%', $type: 'dimension' },
        },
      })
    )
    expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeUndefined()
  })

  it('rejects a dimension missing its unit', () => {
    const { tokens } = tokensOf(
      JSON.stringify({ space: { x: { $value: '16', $type: 'dimension' } } })
    )
    expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeDefined()
  })

  it('accepts a typography composite value', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        type: {
          heading: {
            $type: 'typography',
            $value: {
              fontFamily: 'Inter',
              fontSize: '32px',
              fontWeight: '700',
              lineHeight: '1.2',
            },
          },
        },
      })
    )
    expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeUndefined()
  })

  /* ----------------------------- DANGLING_REFERENCE ------------------------- */
  it('emits DANGLING_REFERENCE error when a reference target is missing', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        color: { x: { $value: '{color.does.not.exist}', $type: 'color' } },
      })
    )
    const issue = issueWithCode(validate(tokens), 'DANGLING_REFERENCE')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('error')
    expect(issue?.path).toBe('color.x')
    expect(issue?.message).toMatch(/does\.not\.exist/)
  })

  it('does NOT emit DANGLING_REFERENCE for a valid reference', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        color: {
          base: { $value: '#ff0000', $type: 'color' },
          alias: { $value: '{color.base}', $type: 'color' },
        },
      })
    )
    expect(issueWithCode(validate(tokens), 'DANGLING_REFERENCE')).toBeUndefined()
  })

  it('detects dangling references inside composite values', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        type: {
          x: {
            $type: 'typography',
            $value: { fontFamily: '{font.missing}' },
          },
        },
      })
    )
    expect(issueWithCode(validate(tokens), 'DANGLING_REFERENCE')).toBeDefined()
  })

  /* ---------------------------- CYCLIC_REFERENCE ---------------------------- */
  it('detects a simple two-token cycle {a} → {b} → {a}', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        a: { x: { $value: '{b.y}', $type: 'color' } },
        b: { y: { $value: '{a.x}', $type: 'color' } },
      })
    )
    const issue = issueWithCode(validate(tokens), 'CYCLIC_REFERENCE')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('error')
    expect(issue?.message).toMatch(/→/)
  })

  it('detects a longer cycle {a} → {b} → {c} → {a}', () => {
    const { tokens } = tokensOf(
      JSON.stringify({
        a: { x: { $value: '{b.x}', $type: 'color' } },
        b: { x: { $value: '{c.x}', $type: 'color' } },
        c: { x: { $value: '{a.x}', $type: 'color' } },
      })
    )
    expect(issueWithCode(validate(tokens), 'CYCLIC_REFERENCE')).toBeDefined()
  })

  it('does NOT flag a self-referencing-but-valid chain that terminates', () => {
    // Not actually self-referencing — just a 3-hop chain ending in a literal.
    const { tokens } = tokensOf(
      JSON.stringify({
        a: { x: { $value: '{b.x}', $type: 'color' } },
        b: { x: { $value: '{c.x}', $type: 'color' } },
        c: { x: { $value: '#ff0000', $type: 'color' } },
      })
    )
    expect(issueWithCode(validate(tokens), 'CYCLIC_REFERENCE')).toBeUndefined()
  })

  it('emits REFERENCE_TOO_DEEP (warning) for a deep-but-acyclic chain, not CYCLIC_REFERENCE', () => {
    // 36-link chain (0..35) ending in a literal — no path repeats, so this
    // is NOT a cycle. Regression test for the false-positive where depth-
    // exhaustion was incorrectly treated as cyclic. Built flat so every
    // hop lands at the top level where the parser sees it.
    const chainObj: Record<string, unknown> = {}
    for (let i = 0; i < 35; i++) {
      chainObj[i] = { $value: `{${i + 1}}`, $type: 'color' }
    }
    chainObj[35] = { $value: '#ff0000', $type: 'color' }

    const { tokens } = tokensOf(JSON.stringify(chainObj))
    const issues = validate(tokens)

    // Must NOT be reported as a cycle.
    expect(issueWithCode(issues, 'CYCLIC_REFERENCE')).toBeUndefined()
    // Must be reported as too-deep, with warning severity (not error).
    const tooDeep = issueWithCode(issues, 'REFERENCE_TOO_DEEP')
    expect(tooDeep).toBeDefined()
    expect(tooDeep?.severity).toBe('warning')
  })

  it('detects a cycle through a composite (typography) sub-reference', () => {
    // type.body's $value is an object. Its first sub-ref (fontFamily) terminates
    // at a literal, but its second sub-ref (fontSize) is a self-cycle.
    // The old detectCycle only followed refs[0] and missed this entirely.
    const { tokens } = tokensOf(
      JSON.stringify({
        font: { sans: { $value: 'Inter', $type: 'fontFamily' } },
        type: {
          body: {
            $type: 'typography',
            $value: { fontFamily: '{font.sans}', fontSize: '{type.body}' },
          },
        },
      })
    )
    expect(issueWithCode(validate(tokens), 'CYCLIC_REFERENCE')).toBeDefined()
  })

  it('detects a cycle that only appears in the second ref of a composite', () => {
    // a → {b, c}; b terminates; c → d → c (cycle through the second ref).
    const { tokens } = tokensOf(
      JSON.stringify({
        terminator: { $value: '#000', $type: 'color' },
        c: { $value: '{d}', $type: 'color' },
        d: { $value: '{c}', $type: 'color' },
        a: {
          $type: 'typography',
          $value: { fontFamily: '{terminator}', fontSize: '{c}' },
        },
      })
    )
    expect(issueWithCode(validate(tokens), 'CYCLIC_REFERENCE')).toBeDefined()
  })

  it('does NOT false-positive on a composite with two terminating refs', () => {
    // Sanity: confirm the DFS doesn't over-report when both sub-refs terminate.
    const { tokens } = tokensOf(
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
    expect(issueWithCode(validate(tokens), 'CYCLIC_REFERENCE')).toBeUndefined()
  })

  it('handles an empty token map', () => {
    const { tokens } = tokensOf(JSON.stringify({}))
    expect(validate(tokens)).toEqual([])
  })

  /* --------------------------- spec references ------------------------------ */
  describe('spec reference URLs', () => {
    /** Spec base URL — every code's reference must start with this. */
    const SPEC_BASE = 'https://tr.designtokens.org/format/'

    it('attaches a reference to MISSING_TYPE issues', () => {
      const { tokens } = tokensOf(
        JSON.stringify({ color: { red: { $value: '#ff0000' } } })
      )
      const issue = issueWithCode(validate(tokens), 'MISSING_TYPE')
      expect(issue?.reference).toBe(`${SPEC_BASE}#type-0`)
    })

    it('attaches a reference to UNKNOWN_TYPE issues', () => {
      const { tokens } = tokensOf(
        JSON.stringify({ x: { y: { $value: 'z', $type: 'magic' } } })
      )
      const issue = issueWithCode(validate(tokens), 'UNKNOWN_TYPE')
      expect(issue?.reference).toBe(`${SPEC_BASE}#types`)
    })

    it('attaches a reference to INVALID_VALUE_FOR_TYPE issues', () => {
      const { tokens } = tokensOf(
        JSON.stringify({ color: { x: { $value: 42, $type: 'color' } } })
      )
      const issue = issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')
      expect(issue?.reference).toBe(`${SPEC_BASE}#types`)
    })

    it('attaches a reference to DANGLING_REFERENCE issues', () => {
      const { tokens } = tokensOf(
        JSON.stringify({
          a: { $value: '{nope}', $type: 'color' },
        })
      )
      const issue = issueWithCode(validate(tokens), 'DANGLING_REFERENCE')
      expect(issue?.reference).toBe(`${SPEC_BASE}#aliases-references`)
    })

    it('attaches a reference to CYCLIC_REFERENCE issues', () => {
      const { tokens } = tokensOf(
        JSON.stringify({
          a: { $value: '{b}', $type: 'color' },
          b: { $value: '{a}', $type: 'color' },
        })
      )
      const issue = issueWithCode(validate(tokens), 'CYCLIC_REFERENCE')
      expect(issue?.reference).toBe(`${SPEC_BASE}#aliases-references`)
    })

    it('attaches a reference to REFERENCE_TOO_DEEP issues', () => {
      // A 36-link acyclic chain exceeds the 32-hop cap and emits a warning.
      const chain: Record<string, unknown> = {
        end: { $value: '#000', $type: 'color' },
      }
      for (let i = 35; i > 0; i--) {
        chain[`t${i}`] = { $value: `{t${i + 1}}`, $type: 'color' }
      }
      const { tokens } = tokensOf(JSON.stringify(chain))
      const issue = issueWithCode(validate(tokens), 'REFERENCE_TOO_DEEP')
      expect(issue?.reference).toBe(`${SPEC_BASE}#aliases-references`)
    })
  })

  /* --------------------- Phase 2: granular value codes ----------------------- */
  describe('per-type validator registry', () => {
    it('rejects a typography token whose $value is a number (INVALID_COMPOSITE_FIELD)', () => {
      // This is the bug Phase 2 fixes: previously the shallow "is it an object"
      // check let a bare number through.
      const { tokens } = tokensOf(
        JSON.stringify({ type: { body: { $value: 42, $type: 'typography' } } })
      )
      const issue = issueWithCode(validate(tokens), 'INVALID_COMPOSITE_FIELD')
      expect(issue).toBeDefined()
      expect(issue?.path).toBe('type.body')
    })

    it('reports INVALID_FONT_WEIGHT for an out-of-range fontWeight', () => {
      const { tokens } = tokensOf(
        JSON.stringify({ fw: { $value: 9999, $type: 'fontWeight' } })
      )
      const issue = issueWithCode(validate(tokens), 'INVALID_FONT_WEIGHT')
      expect(issue).toBeDefined()
      expect(issue?.path).toBe('fw')
    })

    it('reports INVALID_DURATION for a value with no time unit', () => {
      // '2s' is valid (spec permits s and ms); a bare number is not.
      const { tokens } = tokensOf(
        JSON.stringify({ d: { $value: '200', $type: 'duration' } })
      )
      expect(issueWithCode(validate(tokens), 'INVALID_DURATION')).toBeDefined()
    })

    it('accepts both s and ms units for duration (spec-permitted)', () => {
      const { tokens } = tokensOf(
        JSON.stringify({
          a: { $value: '200ms', $type: 'duration' },
          b: { $value: '0.3s', $type: 'duration' },
        })
      )
      expect(issueWithCode(validate(tokens), 'INVALID_DURATION')).toBeUndefined()
    })

    it('reports INVALID_NUMBER for NaN', () => {
      // JSON doesn't allow NaN, but the validator should still reject it if it
      // arrives (e.g. via the JS API or a future input format).
      const { tokens } = tokensOf(
        JSON.stringify({ n: { $value: 42, $type: 'number' } })
      )
      // Patch the parsed token to NaN to simulate the edge case.
      const token = tokens.get('n')
      if (token) token.rawValue = NaN
      expect(issueWithCode(validate(tokens), 'INVALID_NUMBER')).toBeDefined()
    })

    it('reports INVALID_GRADIENT for an empty gradient array', () => {
      const { tokens } = tokensOf(
        JSON.stringify({ g: { $value: [], $type: 'gradient' } })
      )
      const issue = issueWithCode(validate(tokens), 'INVALID_GRADIENT')
      expect(issue?.message).toMatch(/no stops/)
    })

    it('reports a field-level path for a bad typography sub-field', () => {
      const { tokens } = tokensOf(
        JSON.stringify({
          type: {
            body: {
              $type: 'typography',
              $value: { fontFamily: 'Inter', fontSize: 'big' },
            },
          },
        })
      )
      const issues = validate(tokens)
      const bad = issues.find((i) => i.path === 'type.body.fontSize')
      expect(bad).toBeDefined()
      expect(bad?.code).toBe('INVALID_VALUE_FOR_TYPE')
    })

    it('reports a field-level path for a bad shadow color', () => {
      const { tokens } = tokensOf(
        JSON.stringify({
          shadow: {
            md: {
              $type: 'shadow',
              $value: {
                color: 'notacolor',
                offsetX: '0px',
                offsetY: '4px',
              },
            },
          },
        })
      )
      const issues = validate(tokens)
      const bad = issues.find((i) => i.path === 'shadow.md.color')
      expect(bad).toBeDefined()
    })

    it('reports each bad sub-field independently in a single validate() call', () => {
      const { tokens } = tokensOf(
        JSON.stringify({
          t: {
            $type: 'typography',
            $value: { fontSize: 'big', fontWeight: 9999, lineHeight: 2 },
          },
        })
      )
      const paths = validate(tokens)
        .filter((i) => i.path.startsWith('t.'))
        .map((i) => i.path)
      expect(paths.sort()).toEqual(['t.fontSize', 't.fontWeight'])
      // lineHeight 2 is a valid number → not reported.
    })

    it('still accepts a valid color token via the registry (INVALID_VALUE_FOR_TYPE absent)', () => {
      const { tokens } = tokensOf(
        JSON.stringify({ c: { $value: '#ff0000', $type: 'color' } })
      )
      expect(issueWithCode(validate(tokens), 'INVALID_VALUE_FOR_TYPE')).toBeUndefined()
    })

    it('attaches a spec reference to INVALID_FONT_WEIGHT issues', () => {
      const { tokens } = tokensOf(
        JSON.stringify({ fw: { $value: 9999, $type: 'fontWeight' } })
      )
      const issue = issueWithCode(validate(tokens), 'INVALID_FONT_WEIGHT')
      expect(issue?.reference).toBe('https://tr.designtokens.org/format/#font-weight')
    })
  })
})
