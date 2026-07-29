import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useValidationPanel } from '@/composables/useValidationPanel'

/**
 * useValidationPanel tests.
 *
 * The composable is a module-scoped singleton (shared open/closed state for
 * the two validation panels), so state persists across tests — each test
 * resets both refs in `beforeEach` for isolation.
 *
 * jsdom has no layout, so `scrollIntoView` is a no-op there; we verify the
 * observable contract (the ref flips true and the lookup is guarded) rather
 * than the scroll itself. The element-id resolution is exercised by confirming
 * `openForValidation` still resolves when the target element is absent.
 */

describe('useValidationPanel', () => {
  beforeEach(() => {
    // Reset shared singleton state between tests.
    const { openA, openB } = useValidationPanel()
    openA.value = false
    openB.value = false
  })

  it('shares one state instance across callers (singleton)', () => {
    const a = useValidationPanel()
    const b = useValidationPanel()
    a.openA.value = true
    expect(b.openA.value).toBe(true)
  })

  it('starts with both panels closed', () => {
    const { openA, openB } = useValidationPanel()
    expect(openA.value).toBe(false)
    expect(openB.value).toBe(false)
  })

  it('openForValidation("A") opens panel A, leaves B closed', async () => {
    const { openA, openB, openForValidation } = useValidationPanel()
    await openForValidation('A')
    expect(openA.value).toBe(true)
    expect(openB.value).toBe(false)
  })

  it('openForValidation("B") opens panel B, leaves A closed', async () => {
    const { openA, openB, openForValidation } = useValidationPanel()
    await openForValidation('B')
    expect(openB.value).toBe(true)
    expect(openA.value).toBe(false)
  })

  it('opens the panel even when the scroll target element is absent (jsdom)', async () => {
    // No element with id `dtm-validation-A` exists in this test DOM.
    const { openA, openForValidation } = useValidationPanel()
    await expect(openForValidation('A')).resolves.toBeUndefined()
    expect(openA.value).toBe(true)
  })

  it('scrolls the panel into view when its element is present', async () => {
    const scrollIntoView = vi.fn()
    const el = document.createElement('section')
    el.id = 'dtm-validation-A'
    // jsdom doesn't implement scrollIntoView; stub it so we can assert it ran.
    el.scrollIntoView = scrollIntoView
    document.body.appendChild(el)

    try {
      const { openForValidation } = useValidationPanel()
      await openForValidation('A')
      expect(scrollIntoView).toHaveBeenCalledOnce()
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      })
    } finally {
      document.body.removeChild(el)
    }
  })
})
