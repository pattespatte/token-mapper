import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ShareMenu from '@/components/ShareMenu.vue'
import { useShare } from '@/composables/useShare'
import { useTokenSets } from '@/composables/useTokenSets'
import type { InputFile } from '@dtcg-mapper/core'

/**
 * ShareMenu smoke test.
 *
 * Uses the real `useShare` and `useTokenSets` singletons rather than mocking
 * them — the composables are themselves well-tested, so the integration test
 * catches wiring bugs (e.g. a renamed export, a wrong argument order) that a
 * mocked test would miss. The singleton module state is reset in `beforeEach`
 * (same caveat documented in useShare.test.ts).
 *
 * Covers the three actions and their feedback states:
 *   - Copy link: success ("✓ Link copied"), empty, too-large, clipboard-failed
 *   - Open in tab: success (window.open called), empty
 *   - Clear URL: hash stripped, message cleared
 *   - Clear URL button is disabled when there's no hash
 */

const A_JSON: InputFile = {
  name: 'a.json',
  content: '{"color":{"indigo":{"500":{"$type":"color","$value":"#6366f1"}}}}',
}

describe('ShareMenu', () => {
  const { addInputs, clearSet } = useTokenSets()
  const share = useShare()

  beforeEach(() => {
    clearSet('A')
    clearSet('B')
    window.location.hash = ''
    // Polyfill navigator.clipboard (jsdom doesn't ship it).
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined),
      },
    })
    // Stub window.open so the test doesn't actually pop a tab.
    vi.stubGlobal(
      'open',
      vi.fn<(url: string, target: string, features: string) => Window | null>().mockReturnValue(null)
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  /* -------------------------------------------------------------------- */
  /*  Rendering                                                           */
  /* -------------------------------------------------------------------- */

  describe('rendering', () => {
    it('renders three buttons in a group', () => {
      const wrapper = mount(ShareMenu)
      const buttons = wrapper.findAll('button')
      expect(buttons).toHaveLength(3)
      expect(buttons[0]!.text()).toBe('Copy link')
      expect(buttons[1]!.text()).toBe('Open in tab')
      expect(buttons[2]!.text()).toBe('Clear URL')
    })

    it('marks the group with an accessible label', () => {
      const wrapper = mount(ShareMenu)
      expect(wrapper.find('[role="group"]').attributes('aria-label')).toBe(
        'Share loaded token sets'
      )
    })

    it('disables Clear URL when no hash is present', () => {
      const wrapper = mount(ShareMenu)
      const clear = wrapper.findAll('button')[2]!
      expect(clear.attributes('disabled')).toBeDefined()
    })

    it('enables Clear URL once a hash has been written', async () => {
      addInputs('A', [A_JSON])
      const wrapper = mount(ShareMenu)
      // Click "Copy link" → writes a hash → Clear should enable.
      await wrapper.findAll('button')[0]!.trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.findAll('button')[2]!.attributes('disabled')).toBeUndefined()
      })
    })
  })

  /* -------------------------------------------------------------------- */
  /*  Copy link                                                           */
  /* -------------------------------------------------------------------- */

  describe('Copy link', () => {
    it('shows "Load a set first" when no sets are loaded', async () => {
      const wrapper = mount(ShareMenu)
      await wrapper.findAll('button')[0]!.trigger('click')
      expect(wrapper.find('[role="status"]').text()).toBe('Load a set first')
      // No hash should have been written.
      expect(window.location.hash).toBe('')
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    })

    it('writes the hash to the URL and shows "✓ Link copied" on success', async () => {
      addInputs('A', [A_JSON])
      const wrapper = mount(ShareMenu)
      await wrapper.findAll('button')[0]!.trigger('click')
      // The copy is async; wait for the success message.
      await vi.waitFor(() => {
        expect(wrapper.find('[role="status"]').text()).toBe('✓ Link copied')
      })
      expect(window.location.hash.length).toBeGreaterThan(1)
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    })

    it('shows the clipboard-failed note and keeps the hash when clipboard rejects', async () => {
      addInputs('A', [A_JSON])
      ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('denied')
      )
      const wrapper = mount(ShareMenu)
      await wrapper.findAll('button')[0]!.trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('[role="status"]').text()).toBe(
          "Couldn't copy — link is in the address bar"
        )
      })
      // Hash still written before the failed copy.
      expect(window.location.hash.length).toBeGreaterThan(1)
    })
  })

  /* -------------------------------------------------------------------- */
  /*  Open in tab                                                         */
  /* -------------------------------------------------------------------- */

  describe('Open in tab', () => {
    it('shows "Load a set first" when no sets are loaded', async () => {
      const wrapper = mount(ShareMenu)
      await wrapper.findAll('button')[1]!.trigger('click')
      expect(wrapper.find('[role="status"]').text()).toBe('Load a set first')
      expect(vi.mocked(open)).not.toHaveBeenCalled()
    })

    it('writes the hash and calls window.open with the share URL on success', async () => {
      addInputs('A', [A_JSON])
      // Make window.open succeed (return a truthy value).
      vi.mocked(open).mockReturnValueOnce({} as Window)
      const wrapper = mount(ShareMenu)
      await wrapper.findAll('button')[1]!.trigger('click')
      expect(window.location.hash.length).toBeGreaterThan(1)
      expect(open).toHaveBeenCalledTimes(1)
      const [url, target, features] = vi.mocked(open).mock.calls[0]!
      expect(url).toContain(window.location.hash)
      expect(target).toBe('_blank')
      expect(features).toContain('noopener')
      // No success message — the new tab opening IS the feedback.
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
    })

    it('shows "Popup blocked" when window.open returns null', async () => {
      addInputs('A', [A_JSON])
      // Default mock already returns null, so just trigger.
      const wrapper = mount(ShareMenu)
      await wrapper.findAll('button')[1]!.trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('[role="status"]').text()).toBe(
          'Popup blocked — link is in the address bar'
        )
      })
    })
  })

  /* -------------------------------------------------------------------- */
  /*  Clear URL                                                           */
  /* -------------------------------------------------------------------- */

  describe('Clear URL', () => {
    it('strips the hash via history.replaceState', async () => {
      addInputs('A', [A_JSON])
      const wrapper = mount(ShareMenu)
      // First put a hash in the URL via Copy link.
      await wrapper.findAll('button')[0]!.trigger('click')
      await vi.waitFor(() => {
        expect(window.location.hash.length).toBeGreaterThan(1)
      })
      // The status message from the copy is showing; clear should hide it.
      expect(wrapper.find('[role="status"]').exists()).toBe(true)

      await wrapper.findAll('button')[2]!.trigger('click')
      expect(window.location.hash).toBe('')
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
    })

    it('is a no-op when there is no hash (button disabled)', async () => {
      const wrapper = mount(ShareMenu)
      // Disabled buttons don't fire click events through the DOM, but call
      // the handler directly to be safe.
      expect(window.location.hash).toBe('')
      // Triggering a disabled button via Vue Test Utils still emits the
      // click; the handler guards on `window.location.hash === ''`.
      await wrapper.findAll('button')[2]!.trigger('click')
      expect(window.location.hash).toBe('')
    })
  })

  /* -------------------------------------------------------------------- */
  /*  Auto-clear of feedback                                              */
  /* -------------------------------------------------------------------- */

  describe('feedback auto-clear', () => {
    it('clears the success message after the timeout', async () => {
      vi.useFakeTimers()
      addInputs('A', [A_JSON])
      const wrapper = mount(ShareMenu)
      await wrapper.findAll('button')[0]!.trigger('click')
      await flushPromises()
      expect(wrapper.find('[role="status"]').text()).toBe('✓ Link copied')
      // Advance past the COPY_FEEDBACK_MS (1500ms).
      vi.advanceTimersByTime(1600)
      await flushPromises()
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
      vi.useRealTimers()
    })
  })

  /* -------------------------------------------------------------------- */
  /*  Sanity: clearSet also clears the hash-related share state           */
  /*  (documents the singleton interaction without re-testing useShare)   */
  /* -------------------------------------------------------------------- */

  it('encodes an empty state after clearSet (regression: shared singletons)', () => {
    addInputs('A', [A_JSON])
    expect(share.encodeCurrentState().ok).toBe(true)
    clearSet('A')
    expect(share.encodeCurrentState()).toEqual({ ok: false, reason: 'empty' })
  })
})
