/**
 * useSidebar — owns the sidebar's collapsed/expanded state.
 *
 * Module-scoped so the state survives set reloads and gallery navigation
 * within a session. No localStorage persistence in v1 — reload resets to
 * expanded, which is the safer default for first-time visitors.
 *
 * Exposes a derived `sidebarWidth` (CSS length string) so App.vue can bind
 * it directly to its grid-template-columns without re-deriving anything.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue'

/** Width of the collapsed rail — just the toggle button. */
const COLLAPSED_WIDTH = '32px'

/** Module-scoped singleton state. */
const collapsed: Ref<boolean> = ref(false)

export function useSidebar() {
  /** CSS length for the sidebar column, derived from collapse state. */
  const sidebarWidth: ComputedRef<string> = computed(() =>
    collapsed.value ? COLLAPSED_WIDTH : 'var(--dtm-sidebar-width)'
  )

  /** Flip the collapsed state. */
  function toggle(): void {
    collapsed.value = !collapsed.value
  }

  /** Force-expand (no-op if already expanded). */
  function expand(): void {
    collapsed.value = false
  }

  /** Force-collapse (no-op if already collapsed). */
  function collapse(): void {
    collapsed.value = true
  }

  return {
    collapsed,
    sidebarWidth,
    toggle,
    expand,
    collapse,
  }
}
