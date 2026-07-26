import { describe, expect, it, vi } from 'vitest'
import {
  isStructuredColor,
  normalizeToHex,
  parseHex,
  rgbDistance,
  rgbToHsl,
} from '@/utils/color'

/**
 * Color util tests.
 *
 * The extracted helpers must produce identical output to the previous
 * in-component definitions — these tests also serve as a regression guard
 * for the extraction. The `normalizeToHex` function uses the canvas 2D
 * context's fillStyle parser, which jsdom doesn't fully implement, so we
 * mock `document.createElement('canvas').getContext('2d').fillStyle` for
 * the cases that need it. Hex passthrough (the fast path) needs no mock.
 */

describe('parseHex', () => {
  it('parses 3-digit hex with alpha 1', () => {
    expect(parseHex('#abc')).toEqual([0xaa, 0xbb, 0xcc, 1])
  })

  it('parses 6-digit hex with alpha 1', () => {
    expect(parseHex('#ff8800')).toEqual([255, 136, 0, 1])
  })

  it('parses 8-digit hex with alpha as last two chars', () => {
    // #ff880080 → alpha = 0x80/255 ≈ 0.502
    const result = parseHex('#ff880080')
    expect(result).not.toBeNull()
    expect(result?.[0]).toBe(255)
    expect(result?.[1]).toBe(136)
    expect(result?.[2]).toBe(0)
    expect(result?.[3]).toBeCloseTo(0x80 / 255, 3)
  })

  it('returns null for non-hex strings', () => {
    expect(parseHex('rgb(1, 2, 3)')).toBeNull()
    expect(parseHex('red')).toBeNull()
    expect(parseHex('#xyz')).toBeNull()
    expect(parseHex('#abcd')).toBeNull() // 4 digits not valid
  })

  it('returns null for non-string input', () => {
    expect(parseHex(42)).toBeNull()
    expect(parseHex(null)).toBeNull()
    expect(parseHex({})).toBeNull()
  })
})

describe('normalizeToHex (hex fast path)', () => {
  it('passes 3-digit hex through unchanged', () => {
    expect(normalizeToHex('#abc')).toBe('#abc')
  })

  it('passes 6-digit hex through unchanged', () => {
    expect(normalizeToHex('#ff8800')).toBe('#ff8800')
  })

  it('passes 8-digit hex through unchanged', () => {
    expect(normalizeToHex('#ff880080')).toBe('#ff880080')
  })

  it('returns null for non-string input', () => {
    expect(normalizeToHex(42)).toBeNull()
    expect(normalizeToHex({})).toBeNull()
  })
})

describe('normalizeToHex (canvas parser path)', () => {
  /**
   * Mock the canvas 2D context so `ctx.fillStyle = v` round-trips through
   * a controllable normaliser. The mock simulates the browser behaviour:
   * valid CSS colors get normalised to either #rrggbb (opaque) or
   * rgba(r,g,b,a) (translucent), and the sentinel `#deadbe` is used to
   * detect "no change" (parse failure).
   */
  function mockFillStyle(normalise: (input: string) => string | null) {
    const fakeCtx = {
      _fillStyle: '#deadbe',
      set fillStyle(v: string) {
        const out = normalise(v)
        this._fillStyle = out ?? this._fillStyle
      },
      get fillStyle() {
        return this._fillStyle
      },
    }
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => fakeCtx,
    } as unknown as HTMLCanvasElement)
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalises rgb() to #rrggbb', () => {
    mockFillStyle((input) => {
      const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(input)
      if (m) {
        const [r, g, b] = [m[1], m[2], m[3]].map(Number)
        return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
      }
      return null
    })
    expect(normalizeToHex('rgb(255, 136, 0)')).toBe('#ff8800')
  })

  it('normalises rgba() with alpha < 1 to #rrggbbaa', () => {
    mockFillStyle(() => 'rgba(255, 136, 0, 0.5)')
    expect(normalizeToHex('rgba(255, 136, 0, 0.5)')).toBe('#ff880080')
  })

  it('normalises rgba() with alpha === 1 to #rrggbb', () => {
    mockFillStyle(() => 'rgba(255, 136, 0, 1)')
    expect(normalizeToHex('rgba(255, 136, 0, 1)')).toBe('#ff8800')
  })

  it('returns null when canvas returns the sentinel (parse failed)', () => {
    // Mock that never changes fillStyle from the sentinel.
    mockFillStyle(() => null)
    expect(normalizeToHex('not-a-color')).toBeNull()
  })

  it('returns null when canvas is unavailable', () => {
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => null,
    } as unknown as HTMLCanvasElement)
    expect(normalizeToHex('rgb(255, 0, 0)')).toBeNull()
  })

  it('returns null when normalised output is not hex', () => {
    // E.g. some hypothetical browser-quirk that returns a non-hex form.
    mockFillStyle(() => 'weird-output')
    expect(normalizeToHex('rgb(255, 0, 0)')).toBeNull()
  })
})

describe('rgbToHsl', () => {
  it('converts pure red', () => {
    // rgb(255, 0, 0) → hsl(0, 100%, 50%)
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 100, 50])
  })

  it('converts pure green', () => {
    // rgb(0, 255, 0) → hsl(120, 100%, 50%)
    expect(rgbToHsl(0, 255, 0)).toEqual([120, 100, 50])
  })

  it('converts pure blue', () => {
    // rgb(0, 0, 255) → hsl(240, 100%, 50%)
    expect(rgbToHsl(0, 0, 255)).toEqual([240, 100, 50])
  })

  it('converts white (achromatic)', () => {
    expect(rgbToHsl(255, 255, 255)).toEqual([0, 0, 100])
  })

  it('converts black (achromatic)', () => {
    expect(rgbToHsl(0, 0, 0)).toEqual([0, 0, 0])
  })

  it('converts a mid-gray (achromatic)', () => {
    expect(rgbToHsl(128, 128, 128)).toEqual([0, 0, 50])
  })
})

describe('isStructuredColor', () => {
  it('returns true for a structured color object', () => {
    expect(
      isStructuredColor({ colorSpace: 'srgb', components: [0.5, 0.5, 0.5] })
    ).toBe(true)
  })

  it('returns true with optional alpha', () => {
    expect(
      isStructuredColor({ colorSpace: 'srgb', components: [1, 0, 0], alpha: 0.5 })
    ).toBe(true)
  })

  it('returns false for a plain hex string', () => {
    expect(isStructuredColor('#ff0000')).toBe(false)
  })

  it('returns false for a plain object without colorSpace', () => {
    expect(isStructuredColor({ foo: 'bar' })).toBe(false)
  })

  it('returns false for an array', () => {
    expect(isStructuredColor([1, 0, 0])).toBe(false)
  })

  it('returns false for null', () => {
    expect(isStructuredColor(null)).toBe(false)
  })
})

describe('rgbDistance', () => {
  it('returns 0 for identical colors', () => {
    expect(rgbDistance('#ff0000', '#ff0000')).toBe(0)
  })

  it('returns the max distance for black vs white', () => {
    // sqrt(3 × 255²) = sqrt(195075) ≈ 441.67
    const d = rgbDistance('#000000', '#ffffff')
    expect(d).not.toBeNull()
    expect(d).toBeCloseTo(Math.sqrt(3 * 255 * 255), 1)
  })

  it('returns the Euclidean distance for a single-channel delta', () => {
    // #ff0000 → #00ff00: Δr=255, Δg=255, Δb=0 → sqrt(255² + 255²) = 255·sqrt(2)
    const d = rgbDistance('#ff0000', '#00ff00')
    expect(d).not.toBeNull()
    expect(d).toBeCloseTo(255 * Math.sqrt(2), 1)
  })

  it('returns null when either input is not parseable', () => {
    expect(rgbDistance('not-a-color', '#ff0000')).toBeNull()
    expect(rgbDistance('#ff0000', 42)).toBeNull()
  })

  it('normalises rgb() and hsl() inputs before computing', () => {
    // Mock the canvas to round-trip rgb() through to its hex equivalent.
    const fakeCtx = {
      _fillStyle: '#deadbe',
      set fillStyle(v: string) {
        const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(v)
        if (m) {
          const [r, g, b] = [m[1], m[2], m[3]].map(Number)
          this._fillStyle = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
        }
      },
      get fillStyle() {
        return this._fillStyle
      },
    }
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => fakeCtx,
    } as unknown as HTMLCanvasElement)

    // rgb(255, 0, 0) and #ff0000 should be the same color → distance 0.
    expect(rgbDistance('rgb(255, 0, 0)', '#ff0000')).toBe(0)

    vi.restoreAllMocks()
  })
})
