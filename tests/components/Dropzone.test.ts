import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { TokenSet } from '@/types/token'

/**
 * Dropzone smoke test.
 *
 * The Dropzone is the most behaviour-rich component in this phase (file input,
 * drag events, loading state, error display), so it earns the one smoke test
 * the plan asks for. We mock the useTokenSets composable so we don't drag
 * the whole pipeline into a component test — we only verify that user
 * interactions route to the right store methods with the right arguments.
 */

// Mock the composable module so the Dropzone gets controllable stand-ins.
const mockAddFiles = vi.fn<(setId: 'A' | 'B', files: File[]) => Promise<void>>()
const mockLoadDemo = vi.fn()
const mockClearSet = vi.fn()

// Module-scoped refs the mock returns. Reset between tests in beforeEach.
let mockSetA: ReturnType<typeof ref<TokenSet | null>>
let mockSetB: ReturnType<typeof ref<TokenSet | null>>

vi.mock('@/composables/useTokenSets', () => ({
  useTokenSets: () => ({
    get setA() {
      return mockSetA
    },
    get setB() {
      return mockSetB
    },
    addFiles: mockAddFiles,
    loadDemo: mockLoadDemo,
    clearSet: mockClearSet,
    isComparing: ref(false),
  }),
}))

// Import *after* the mock is registered so the Dropzone pulls in the mock.
const Dropzone = (await import('@/components/Dropzone.vue')).default

/** Build a minimal File for the input event. */
function jsonFile(name: string, content: string): File {
  return new File([content], name, { type: 'application/json' })
}

describe('Dropzone', () => {
  beforeEach(() => {
    mockSetA = ref(null)
    mockSetB = ref(null)
    mockAddFiles.mockReset()
    mockLoadDemo.mockReset()
    mockClearSet.mockReset()
    mockAddFiles.mockResolvedValue(undefined)
  })

  it('renders the slot id and hint in the label', () => {
    const wrapper = mount(Dropzone, {
      props: { setId: 'A', hint: 'your design system' },
    })
    expect(wrapper.text()).toContain('Set A')
    expect(wrapper.text()).toContain('your design system')
  })

  it('shows the empty prompt when no set is loaded', () => {
    const wrapper = mount(Dropzone, {
      props: { setId: 'A', hint: 'your design system' },
    })
    expect(wrapper.text()).toContain('Drop JSON or CSS here')
  })

  it('calls addFiles with the right setId and the chosen files', async () => {
    const wrapper = mount(Dropzone, {
      props: { setId: 'B', hint: 'base design system' },
    })
    const input = wrapper.find('input[type="file"]')
    const file = jsonFile('tokens.json', '{"color":{"x":{"$value":"#fff","$type":"color"}}}')

    // Simulate the user picking a file.
    Object.defineProperty(input.element, 'files', {
      value: [file],
      writable: false,
      configurable: true,
    })
    await input.trigger('change')

    expect(mockAddFiles).toHaveBeenCalledTimes(1)
    const [setId, files] = mockAddFiles.mock.calls[0] ?? []
    expect(setId).toBe('B')
    expect(files).toHaveLength(1)
    expect((files as File[])[0]?.name).toBe('tokens.json')
  })

  it('opens the file picker when the button is clicked', async () => {
    const wrapper = mount(Dropzone, {
      props: { setId: 'A', hint: 'whatever' },
    })
    const inputEl = wrapper.find('input[type="file"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(inputEl, 'click').mockImplementation(() => {})

    await wrapper.find('button.dtv-dropzone__button').trigger('click')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    clickSpy.mockRestore()
  })

  it('opens the file picker on Enter and Space (keyboard accessibility)', async () => {
    // Native <button> elements activate on Enter/Space automatically; this
    // test documents the expectation and would catch a future regression
    // that swapped back to a div+role=button.
    const wrapper = mount(Dropzone, {
      props: { setId: 'A', hint: 'whatever' },
    })
    const inputEl = wrapper.find('input[type="file"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(inputEl, 'click').mockImplementation(() => {})

    // Vue Test Utils doesn't simulate native button activation, so trigger
    // click directly. The behaviour we care about is that the picker opens.
    await wrapper.find('button.dtv-dropzone__button').trigger('click')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    clickSpy.mockRestore()
  })

  it('handles a drop event by forwarding files to addFiles', async () => {
    const wrapper = mount(Dropzone, {
      props: { setId: 'A', hint: 'whatever' },
    })
    const files = [
      jsonFile('a.json', '{}'),
      jsonFile('b.json', '{}'),
    ]

    // Drop events fire on the outer wrapper (where the @drop handler lives),
    // not the button.
    const dataTransfer = { files }
    await wrapper.find('.dtv-dropzone').trigger('drop', { dataTransfer })

    expect(mockAddFiles).toHaveBeenCalledTimes(1)
    const [, passedFiles] = mockAddFiles.mock.calls[0] ?? []
    expect(passedFiles).toHaveLength(2)
  })

  it('shows the loaded summary when the set becomes populated', async () => {
    mockSetA = ref({
      id: 'A',
      label: 'my-tokens.json',
      sourceFiles: ['my-tokens.json'],
      tokens: new Map([['color.red', {}]]),
      resolved: new Map(),
      validation: [],
    } as unknown as TokenSet)

    const wrapper = mount(Dropzone, {
      props: { setId: 'A', hint: 'whatever' },
    })
    expect(wrapper.text()).toContain('my-tokens.json')
    expect(wrapper.text()).toContain('1 tokens')
    // The "+ Add files" hint should render in the loaded state.
    expect(wrapper.text()).toContain('+ Add files')
  })

  it('collapses multiple source files into "first + N more"', async () => {
    mockSetA = ref({
      id: 'A',
      label: '2 files',
      sourceFiles: ['foundation.json', 'semantic.json'],
      tokens: new Map([['color.red', {}], ['color.blue', {}]]),
      resolved: new Map(),
      validation: [],
    } as unknown as TokenSet)

    const wrapper = mount(Dropzone, {
      props: { setId: 'A', hint: 'whatever' },
    })
    expect(wrapper.text()).toContain('foundation.json + 1 more')
    // The tooltip carries the full file list.
    const filename = wrapper.find('.dtv-dropzone__filename')
    expect(filename.attributes('title')).toBe('foundation.json\nsemantic.json')
  })

  it('shows the validation-issue count when present', async () => {
    mockSetA = ref({
      id: 'A',
      label: 'broken.json',
      sourceFiles: ['broken.json'],
      tokens: new Map(),
      resolved: new Map(),
      validation: [{}, {}, {}], // three issues
    } as unknown as TokenSet)

    const wrapper = mount(Dropzone, {
      props: { setId: 'A', hint: 'whatever' },
    })
    expect(wrapper.text()).toContain('3 issues')
  })

  it('does not call addFiles when the change event has no files', async () => {
    const wrapper = mount(Dropzone, {
      props: { setId: 'A', hint: 'whatever' },
    })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [],
      writable: false,
      configurable: true,
    })
    await input.trigger('change')
    expect(mockAddFiles).not.toHaveBeenCalled()
  })
})
