import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import type { TokenSet, NormalizedToken, ResolvedToken } from '@dtcg-mapper/core'

/**
 * DownloadMenu smoke test.
 *
 * Mocks `useTokenSets` and `@/utils/download` so we can verify that the right
 * serialised JSON lands in `downloadTextFile` with the expected filename and
 * MIME type, and that the raw vs resolved modes produce different content when
 * the set contains aliases.
 */

const mockDownload = vi.fn<(filename: string, content: string, mimeType: string) => void>()

// Stub the I/O module so the component test stays pure.
vi.mock('@/utils/download', () => ({
  downloadTextFile: (...args: Parameters<typeof mockDownload>) => mockDownload(...args),
  sanitizeFilename: (input: string) =>
    input.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-') || 'fallback',
}))

let setA: Ref<TokenSet | null>
let setB: Ref<TokenSet | null>

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
const DownloadMenu = (await import('@/components/DownloadMenu.vue')).default

/** Build a small hand-rolled TokenSet with one alias token. */
function sampleSetWithAlias(): TokenSet {
  const brandToken: NormalizedToken = {
    path: 'color.brand',
    segments: ['color', 'brand'],
    rawValue: '#6366f1',
    type: 'color',
  }

  const aliasToken: NormalizedToken = {
    path: 'color.surface.primary',
    segments: ['color', 'surface', 'primary'],
    rawValue: '{color.brand}',
    type: 'color',
  }

  const tokens = new Map<string, NormalizedToken>([
    ['color.brand', brandToken],
    ['color.surface.primary', aliasToken],
  ])

  const resolvedBrand: ResolvedToken = {
    ...brandToken,
    resolvedValue: '#6366f1',
    aliasChain: [],
    hasError: false,
  }

  const resolvedAlias: ResolvedToken = {
    ...aliasToken,
    resolvedValue: '#6366f1',
    aliasChain: [{ path: 'color.brand', raw: '{color.brand}', resolved: '#6366f1' }],
    hasError: false,
  }

  const resolved = new Map<string, ResolvedToken>([
    ['color.brand', resolvedBrand],
    ['color.surface.primary', resolvedAlias],
  ])

  return {
    id: 'A',
    label: 'my-tokens.json',
    sourceFiles: ['my-tokens.json'],
    tokens,
    resolved,
    validation: [],
  }
}

describe('DownloadMenu', () => {
  beforeEach(() => {
    setA = ref(null)
    setB = ref(null)
    mockDownload.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /* -------------------------------------------------------------------- */
  /*  Rendering                                                           */
  /* -------------------------------------------------------------------- */

  describe('rendering', () => {
    it('renders the trigger button with "JSON" text', () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      const trigger = w.find('.dtm-download-menu__trigger')
      expect(trigger.exists()).toBe(true)
      expect(trigger.text()).toContain('JSON')
    })

    it('hides the popover initially', () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      expect(w.find('[role="menu"]').exists()).toBe(false)
    })

    it('shows the popover with two items after clicking the trigger', async () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      await w.find('.dtm-download-menu__trigger').trigger('click')
      const menu = w.find('[role="menu"]')
      expect(menu.exists()).toBe(true)
      const items = w.findAll('[role="menuitem"]')
      expect(items).toHaveLength(2)
      expect(items[0]!.text()).toBe('Raw (keep references)')
      expect(items[1]!.text()).toBe('Resolved (literals)')
    })

    it('sets aria-expanded on the trigger', async () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      expect(w.find('.dtm-download-menu__trigger').attributes('aria-expanded')).toBe('false')
      await w.find('.dtm-download-menu__trigger').trigger('click')
      expect(w.find('.dtm-download-menu__trigger').attributes('aria-expanded')).toBe('true')
    })
  })

  /* -------------------------------------------------------------------- */
  /*  Download actions                                                   */
  /* -------------------------------------------------------------------- */

  describe('download', () => {
    it('triggers download with sanitised filename and JSON content on Raw click', async () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      await w.find('.dtm-download-menu__trigger').trigger('click')
      await w.findAll('[role="menuitem"]')[0]!.trigger('click')
      await flushPromises()

      expect(mockDownload).toHaveBeenCalledTimes(1)
      const [filename, content, mimeType] = mockDownload.mock.calls[0]!
      // sanitizeFilename strips the dot: 'my-tokens.json' → 'my-tokens-json' → 'my-tokens-json.json'
      expect(filename).toBe('my-tokens-json.json')
      expect(mimeType).toBe('application/json')

      const parsed = JSON.parse(content)
      // Raw mode: the alias value should be the reference string.
      expect(parsed.color.surface.primary.$value).toBe('{color.brand}')
      // Brand token should have its literal.
      expect(parsed.color.brand.$value).toBe('#6366f1')
    })

    it('emits resolved literals on Resolved click', async () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      await w.find('.dtm-download-menu__trigger').trigger('click')
      await w.findAll('[role="menuitem"]')[1]!.trigger('click')
      await flushPromises()

      expect(mockDownload).toHaveBeenCalledTimes(1)
      const [, content] = mockDownload.mock.calls[0]!
      const parsed = JSON.parse(content)
      // Resolved mode: the alias should be replaced with the literal.
      expect(parsed.color.surface.primary.$value).toBe('#6366f1')
    })

    it('produces different content for raw vs resolved when aliases exist', async () => {
      setA.value = sampleSetWithAlias()

      // Click Raw
      const wRaw = mount(DownloadMenu, { props: { setId: 'A' } })
      await wRaw.find('.dtm-download-menu__trigger').trigger('click')
      await wRaw.findAll('[role="menuitem"]')[0]!.trigger('click')
      await flushPromises()
      const rawContent = mockDownload.mock.calls[0]![1]

      // Click Resolved
      const wResolved = mount(DownloadMenu, { props: { setId: 'A' } })
      await wResolved.find('.dtm-download-menu__trigger').trigger('click')
      await wResolved.findAll('[role="menuitem"]')[1]!.trigger('click')
      await flushPromises()
      const resolvedContent = mockDownload.mock.calls[1]![1]

      expect(rawContent).not.toBe(resolvedContent)
      // Raw keeps the reference, resolved replaces it.
      expect(JSON.parse(rawContent).color.surface.primary.$value).toBe('{color.brand}')
      expect(JSON.parse(resolvedContent).color.surface.primary.$value).toBe('#6366f1')
    })

    it('falls back to set-ID-based filename when label is empty', async () => {
      const set = sampleSetWithAlias()
      set.label = ''
      setA.value = set
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      await w.find('.dtm-download-menu__trigger').trigger('click')
      await w.findAll('[role="menuitem"]')[0]!.trigger('click')
      await flushPromises()

      const [filename] = mockDownload.mock.calls[0]!
      expect(filename).toBe('set-A.json')
    })

    it('reads from setB when setId is B', async () => {
      setB.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'B' } })
      await w.find('.dtm-download-menu__trigger').trigger('click')
      await w.findAll('[role="menuitem"]')[0]!.trigger('click')
      await flushPromises()

      expect(mockDownload).toHaveBeenCalledTimes(1)
      const [filename, content] = mockDownload.mock.calls[0]!
      // sanitizeFilename strips the dot: 'my-tokens.json' → 'my-tokens-json' → 'my-tokens-json.json'
      expect(filename).toBe('my-tokens-json.json')
      // Content should be valid JSON with the expected structure.
      const parsed = JSON.parse(content)
      expect(parsed.color).toBeDefined()
    })

    it('does not download when the set is null (no-op guard)', async () => {
      setA.value = null
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      // Trigger button still renders but download is guarded.
      await w.find('.dtm-download-menu__trigger').trigger('click')
      await w.findAll('[role="menuitem"]')[0]!.trigger('click')
      await flushPromises()

      expect(mockDownload).not.toHaveBeenCalled()
    })

    it('includes $type in output for tokens that have it', async () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      await w.find('.dtm-download-menu__trigger').trigger('click')
      await w.findAll('[role="menuitem"]')[0]!.trigger('click')
      await flushPromises()

      const [, content] = mockDownload.mock.calls[0]!
      const parsed = JSON.parse(content)
      expect(parsed.color.brand.$type).toBe('color')
    })

    it('omits $description from output when tokens lack it', async () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      await w.find('.dtm-download-menu__trigger').trigger('click')
      await w.findAll('[role="menuitem"]')[0]!.trigger('click')
      await flushPromises()

      const [, content] = mockDownload.mock.calls[0]!
      const parsed = JSON.parse(content)
      // Sample tokens have no description.
      expect(parsed.color.brand.$description).toBeUndefined()
    })
  })

  /* -------------------------------------------------------------------- */
  /*  Popover close behaviour                                             */
  /* -------------------------------------------------------------------- */

  describe('popover close', () => {
    it('closes the popover after clicking a menu item', async () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' } })
      await w.find('.dtm-download-menu__trigger').trigger('click')
      expect(w.find('[role="menu"]').exists()).toBe(true)

      await w.findAll('[role="menuitem"]')[0]!.trigger('click')
      await flushPromises()
      expect(w.find('[role="menu"]').exists()).toBe(false)
    })

    it('closes on outside click', async () => {
      setA.value = sampleSetWithAlias()
      const w = mount(DownloadMenu, { props: { setId: 'A' }, attachTo: document.body })
      await w.find('.dtm-download-menu__trigger').trigger('click')
      expect(w.find('[role="menu"]').exists()).toBe(true)

      // Dispatch a click on the document that is outside the component.
      document.dispatchEvent(new MouseEvent('click'))
      await flushPromises()
      expect(w.find('[role="menu"]').exists()).toBe(false)

      w.unmount()
    })
  })
})
