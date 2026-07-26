import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useClipboard } from '@/composables/useClipboard'

/**
 * useClipboard tests.
 *
 * The composable wraps `navigator.clipboard.writeText`, which jsdom doesn't
 * implement by default — we polyfill it per test. Fake timers drive the
 * 1200ms reset window so we don't actually wait.
 */

describe('useClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts with copied = false', () => {
    const { copied } = useClipboard()
    expect(copied.value).toBe(false)
  })

  it('copy() sets copied to true after success', async () => {
    const { copied, copy } = useClipboard()
    await copy('hello')
    expect(copied.value).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello')
  })

  it('resets copied back to false after 1200ms', async () => {
    const { copied, copy } = useClipboard()
    await copy('hello')
    expect(copied.value).toBe(true)

    vi.advanceTimersByTime(1199)
    expect(copied.value).toBe(true)

    vi.advanceTimersByTime(2) // total 1201ms
    expect(copied.value).toBe(false)
  })

  it('does not reset before 1200ms', async () => {
    const { copied, copy } = useClipboard()
    await copy('hello')
    vi.advanceTimersByTime(500)
    expect(copied.value).toBe(true)
  })

  it('rapid second copy clears the previous reset timer', async () => {
    const { copied, copy } = useClipboard()
    await copy('first')
    vi.advanceTimersByTime(800) // 800ms in, 400ms left before reset
    expect(copied.value).toBe(true)

    await copy('second') // should clear previous timer, start a new 1200ms
    expect(copied.value).toBe(true)

    vi.advanceTimersByTime(1199)
    expect(copied.value).toBe(true) // still true because new timer hasn't fired

    vi.advanceTimersByTime(2)
    expect(copied.value).toBe(false)
  })

  it('stays silent (copied = false) when clipboard rejects', async () => {
    const mockErr = new Error('permission denied')
    ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(mockErr)
    const { copied, copy } = useClipboard()
    await copy('whatever')
    expect(copied.value).toBe(false)
  })

  it('resolves even when clipboard rejects (no throw)', async () => {
    ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('perm')
    )
    const { copy } = useClipboard()
    await expect(copy('whatever')).resolves.toBeUndefined()
  })

  it('each composable instance has its own copied state', async () => {
    const a = useClipboard()
    const b = useClipboard()
    await a.copy('a-text')
    expect(a.copied.value).toBe(true)
    expect(b.copied.value).toBe(false)
  })

  it('cleanup() clears pending reset timer', async () => {
    const { copied, copy, cleanup } = useClipboard()
    await copy('hello')
    cleanup()
    vi.advanceTimersByTime(5000)
    // copied stays true because cleanup cleared the timer before it fired;
    // real callers also unmount, but the state at this point is irrelevant
    // since the component is gone. Test just verifies no exception is thrown.
    expect(copied.value).toBe(true) // unchanged — timer was cleared
  })

  it('cleanup() is idempotent when there is no pending timer', () => {
    const { cleanup } = useClipboard()
    expect(() => cleanup()).not.toThrow()
  })
})
