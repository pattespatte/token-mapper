import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import ExportMenu from '@/components/ExportMenu.vue'
import type { DiffResult, TokenDiff } from '@dtcg-mapper/core'
import type { TokenSet } from '@dtcg-mapper/core'

/**
 * ExportMenu smoke test.
 *
 * Mocks `useDiff`, `useTokenSets`, and the DOM-side helpers
 * (`URL.createObjectURL`, `<a>.click()`) so we can verify that the right
 * report string lands in the right destination (download vs clipboard) for
 * each of the four buttons.
 */

const mockCopy = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
const mockDownload = vi.fn<(filename: string, content: string, mimeType: string) => void>()

// Stub the I/O modules so the component test stays pure.
vi.mock('@/utils/download', () => ({
  downloadTextFile: (filename: string, content: string, mimeType: string) =>
    mockDownload(filename, content, mimeType),
  sanitizeFilename: (input: string) =>
    input.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-') || 'fallback',
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copied: ref(false),
    copy: mockCopy,
    cleanup: () => {},
  }),
}))

let diff: ComputedRef<DiffResult | null>
let setA: Ref<TokenSet | null>
let setB: Ref<TokenSet | null>

vi.mock('@/composables/useDiff', () => ({
  useDiff: () => ({
    get diff() {
      return diff
    },
  }),
}))

vi.mock('@/composables/useTokenSets', () => ({
  useTokenSets: () => ({
    get setA() {
      return setA
    },
    get setB() {
      return setB
    },
  }),
}))

// Import *after* mocks are registered.
await import('@/components/ExportMenu.vue')

/** Build a small hand-rolled diff for the export-content assertions. */
function sampleDiff(): DiffResult {
  const changed: TokenDiff = {
    path: 'spacing.md',
    bucket: 'changed',
    explanation: { summary: '+4px' },
  }
  const missing: TokenDiff = { path: 'a.b', bucket: 'missing' }
  const extra: TokenDiff = { path: 'c.d', bucket: 'extra' }
  return {
    matching: [],
    changed: [changed],
    missing: [missing],
    extra: [extra],
  }
}

describe('ExportMenu', () => {
  beforeEach(() => {
    diff = computed(() => null)
    setA = ref(null)
    setB = ref(null)
    mockCopy.mockClear()
    mockDownload.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders four buttons', () => {
    const w = mount(ExportMenu)
    const buttons = w.findAll('button')
    expect(buttons).toHaveLength(4)
    const labels = buttons.map((b) => b.text())
    expect(labels).toEqual(['Export MD', 'Copy MD', 'Export JSON', 'Copy JSON'])
  })

  it('disables all buttons when diff is null', () => {
    diff = computed(() => null)
    const w = mount(ExportMenu)
    const disabled = w.findAll('button').filter((b) => b.attributes('disabled') !== undefined)
    expect(disabled).toHaveLength(4)
  })

  it('Export MD triggers a .md download with the report content', async () => {
    diff = computed(() => sampleDiff())
    setA.value = { label: 'a.json' } as TokenSet
    setB.value = { label: 'b.json' } as TokenSet
    const w = mount(ExportMenu)
    await flushPromises()

    await w.get('button:nth-child(1)').trigger('click')
    expect(mockDownload).toHaveBeenCalledTimes(1)
    const [filename, content, mimeType] = mockDownload.mock.calls[0]!
    // Dots in labels are sanitized to `-` (not in filename allowlist) to
    // avoid ambiguity with the .md / .json extension.
    expect(filename).toBe('token-mapper-diff-a-json-vs-b-json.md')
    expect(mimeType).toBe('text/markdown')
    // Report body still uses the original labels (with dots) for readability.
    expect(content).toContain('# Diff: a.json vs b.json')
    expect(content).toContain('- `spacing.md` — `+4px`')
  })

  it('Export JSON triggers a .json download with valid JSON', async () => {
    diff = computed(() => sampleDiff())
    setA.value = { label: 'a.json' } as TokenSet
    setB.value = { label: 'b.json' } as TokenSet
    const w = mount(ExportMenu)
    await flushPromises()

    await w.get('button:nth-child(3)').trigger('click')
    expect(mockDownload).toHaveBeenCalledTimes(1)
    const [filename, content, mimeType] = mockDownload.mock.calls[0]!
    expect(filename.endsWith('.json')).toBe(true)
    expect(mimeType).toBe('application/json')
    const parsed = JSON.parse(content)
    expect(parsed.counts).toEqual({ matching: 0, changed: 1, missing: 1, extra: 1 })
  })

  it('Copy MD calls the clipboard with the report content', async () => {
    diff = computed(() => sampleDiff())
    setA.value = { label: 'a.json' } as TokenSet
    setB.value = { label: 'b.json' } as TokenSet
    const w = mount(ExportMenu)
    await flushPromises()

    await w.get('button:nth-child(2)').trigger('click')
    expect(mockCopy).toHaveBeenCalledTimes(1)
    const copiedText = mockCopy.mock.calls[0]![0]
    expect(copiedText).toContain('# Diff: a.json vs b.json')
  })

  it('Copy JSON calls the clipboard with JSON content', async () => {
    diff = computed(() => sampleDiff())
    setA.value = { label: 'a' } as TokenSet
    setB.value = { label: 'b' } as TokenSet
    const w = mount(ExportMenu)
    await flushPromises()

    await w.get('button:nth-child(4)').trigger('click')
    expect(mockCopy).toHaveBeenCalledTimes(1)
    const copiedText = mockCopy.mock.calls[0]![0]
    JSON.parse(copiedText) // throws if not valid JSON
  })

  it('no-ops all buttons when diff is null', async () => {
    diff = computed(() => null)
    const w = mount(ExportMenu)
    await flushPromises()

    for (const button of w.findAll('button')) {
      await button.trigger('click')
    }
    expect(mockDownload).not.toHaveBeenCalled()
    expect(mockCopy).not.toHaveBeenCalled()
  })

  it('renders a labelled group for accessibility', () => {
    const w = mount(ExportMenu)
    expect(w.get('div').attributes('role')).toBe('group')
    expect(w.get('div').attributes('aria-label')).toBe('Export comparison report')
  })
})
