import { describe, expect, it } from 'vitest'
import { parseFiles } from '@/pipeline/parse'
import type { InputFile } from '@/pipeline/parse'

/** Helper: wrap raw JSON text as a single-file InputFile. */
function file(name: string, content: string): InputFile {
  return { name, content }
}

describe('parseFiles', () => {
  it('parses a single file with a flat set of tokens', () => {
    const result = parseFiles([
      file(
        'a.json',
        JSON.stringify({
          color: {
            red: { $value: '#ff0000', $type: 'color' },
            blue: { $value: '#0000ff', $type: 'color' },
          },
        })
      ),
    ])

    expect(result.issues).toEqual([])
    // Source order is preserved (red defined before blue in the JSON).
    expect([...result.tokens.keys()]).toEqual(['color.red', 'color.blue'])
    expect(result.tokens.get('color.red')?.rawValue).toBe('#ff0000')
    expect(result.tokens.get('color.red')?.type).toBe('color')
  })

  it('sorts nothing — map keys preserve insertion order', () => {
    // Sanity check: blue comes before red alphabetically but was inserted after.
    // (The walker iterates Object.keys, which preserve source order for strings.)
    const result = parseFiles([
      file(
        'a.json',
        JSON.stringify({
          color: {
            red: { $value: '#ff0000' },
            blue: { $value: '#0000ff' },
          },
        })
      ),
    ])
    expect([...result.tokens.keys()]).toEqual(['color.red', 'color.blue'])
  })

  it('merges tokens across multiple files into one map', () => {
    const result = parseFiles([
      file(
        'foundation.json',
        JSON.stringify({
          color: {
            pink: {
              900: { $value: '#3d0414', $type: 'color' },
            },
          },
        })
      ),
      file(
        'semantic.json',
        JSON.stringify({
          color: {
            surface: {
              primary: {
                default: { $value: '{color.pink.900}', $type: 'color' },
              },
            },
          },
        })
      ),
    ])

    expect(result.issues).toEqual([])
    expect([...result.tokens.keys()]).toEqual([
      'color.pink.900',
      'color.surface.primary.default',
    ])
    expect(result.tokens.get('color.surface.primary.default')?.rawValue).toBe(
      '{color.pink.900}'
    )
  })

  it('handles space-containing segment keys with proper escaping', () => {
    // The sample dataset has a group key "gray cool" — its dotted path must be
    // `color."gray cool".50`, and the parser records segments un-escaped.
    const result = parseFiles([
      file(
        'a.json',
        JSON.stringify({
          color: {
            'gray cool': {
              50: { $value: '#f9f9fb', $type: 'color' },
            },
          },
        })
      ),
    ])

    expect(result.issues).toEqual([])
    expect([...result.tokens.keys()]).toEqual(['color."gray cool".50'])

    const token = result.tokens.get('color."gray cool".50')
    expect(token?.segments).toEqual(['color', 'gray cool', '50'])
    expect(token?.rawValue).toBe('#f9f9fb')
  })

  it('records a DUPLICATE_PATH warning when two files define the same path', () => {
    const result = parseFiles([
      file('a.json', JSON.stringify({ x: { y: { $value: '1' } } })),
      file('b.json', JSON.stringify({ x: { y: { $value: '2' } } })),
    ])

    expect(result.tokens.get('x.y')?.rawValue).toBe('1') // first wins
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.code).toBe('DUPLICATE_PATH')
    expect(result.issues[0]?.severity).toBe('warning')
    expect(result.issues[0]?.path).toBe('x.y')
  })

  it('emits INVALID_JSON for a malformed file and still parses others', () => {
    const result = parseFiles([
      file('bad.json', '{ not valid json'),
      file('good.json', JSON.stringify({ ok: { $value: '1' } })),
    ])

    expect([...result.tokens.keys()]).toEqual(['ok'])
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.code).toBe('INVALID_JSON')
    expect(result.issues[0]?.severity).toBe('error')
    expect(result.issues[0]?.path).toBe('bad.json')
    expect(result.issues[0]?.message).toMatch(/bad\.json/)
  })

  it('rejects top-level JSON arrays with INVALID_JSON', () => {
    const result = parseFiles([file('arr.json', '[1, 2, 3]')])
    expect(result.tokens.size).toBe(0)
    expect(result.issues[0]?.code).toBe('INVALID_JSON')
    expect(result.issues[0]?.message).toMatch(/object/)
  })

  it('parses deeply nested groups', () => {
    const result = parseFiles([
      file(
        'deep.json',
        JSON.stringify({
          a: { b: { c: { d: { e: { $value: 'deep', $type: 'color' } } } } },
        })
      ),
    ])
    expect(result.issues).toEqual([])
    expect(result.tokens.get('a.b.c.d.e')?.rawValue).toBe('deep')
    expect(result.tokens.get('a.b.c.d.e')?.segments).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
  })

  it('parses a token missing $type without throwing', () => {
    const result = parseFiles([
      file('a.json', JSON.stringify({ x: { y: { $value: '#fff' } } })),
    ])
    expect(result.issues).toEqual([])
    const token = result.tokens.get('x.y')
    expect(token?.rawValue).toBe('#fff')
    expect(token?.type).toBeUndefined()
  })

  it('ignores $-prefixed properties on groups', () => {
    // A group may carry its own $description/$type/$extensions — these must
    // not become child tokens.
    const result = parseFiles([
      file(
        'a.json',
        JSON.stringify({
          color: {
            $description: 'Color palette',
            $extensions: { 'org.tool': { foo: 1 } },
            red: { $value: '#ff0000', $type: 'color' },
          },
        })
      ),
    ])
    expect([...result.tokens.keys()]).toEqual(['color.red'])
  })

  it('preserves $description on tokens', () => {
    const result = parseFiles([
      file(
        'a.json',
        JSON.stringify({
          color: {
            red: {
              $value: '#ff0000',
              $type: 'color',
              $description: 'Primary red',
            },
          },
        })
      ),
    ])
    expect(result.tokens.get('color.red')?.description).toBe('Primary red')
  })

  it('handles composite (object) $values without flattening them', () => {
    // Typography tokens carry an object value — the parser stores it as-is;
    // resolution/validation happen later.
    const result = parseFiles([
      file(
        'a.json',
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
      ),
    ])
    const token = result.tokens.get('type.heading')
    expect(token?.type).toBe('typography')
    expect(token?.rawValue).toEqual({
      fontFamily: 'Inter',
      fontSize: '32px',
      fontWeight: '700',
      lineHeight: '1.2',
    })
  })

  it('returns an empty map for no files', () => {
    const result = parseFiles([])
    expect(result.tokens.size).toBe(0)
    expect(result.issues).toEqual([])
  })

  it('handles a token whose $value is itself a $-prefixed-looking string', () => {
    // A literal value of "$value" must not confuse the walker into treating
    // it as a key. We set $value to the literal string "$type".
    const result = parseFiles([
      file('a.json', JSON.stringify({ x: { $value: '$type' } })),
    ])
    expect(result.tokens.get('x')?.rawValue).toBe('$type')
  })
})
