<script setup lang="ts">
/**
 * App shell. Wires header, sidebar, toolbar, gallery, and validation panel.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │              AppHeader                  │
 *   ├──────────┬──────────────────────────────┤
 *   │ Sidebar  │ Toolbar                      │
 *   │ (cats)   │ ─────────────────────────── │
 *   │          │ Gallery                      │
 *   │          │ ─────────────────────────── │
 *   │          │ ValidationPanel              │
 *   └──────────┴──────────────────────────────┘
 *
 * Browse mode (one set loaded) and compare mode (both loaded) both render
 * through the Gallery component, which takes a `compare` prop.
 */

import { ref, watch, onMounted, onUnmounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import Sidebar from '@/components/Sidebar.vue'
import Toolbar from '@/components/Toolbar.vue'
import Gallery from '@/components/Gallery.vue'
import ValidationPanel from '@/components/ValidationPanel.vue'
import Inspector from '@/components/Inspector.vue'
import DiffInspector from '@/components/DiffInspector.vue'
import { useTokenSets } from '@/composables/useTokenSets'
import { useGallery } from '@/composables/useGallery'
import { useSidebar } from '@/composables/useSidebar'
import { useShare } from '@/composables/useShare'
import { usePersistence } from '@/composables/usePersistence'

const { isComparing, setA, setB } = useTokenSets()
const { resetCategory } = useGallery()
const { sidebarWidth } = useSidebar()
const { readFromUrl, loadFromHash } = useShare()
const { restoreFromStorage, saveState } = usePersistence()

const validationOpen = ref(false)

/**
 * Signal that changes whenever the loaded source list changes. The label is
 * a stable string derived from the accumulated filenames, so it shifts on
 * every upload, append, or clear — exactly the events that should trigger a
 * category reset (below) and a debounced persistence save (further below).
 */
const setSignal = () => [setA.value?.label, setB.value?.label]

// When the browse set changes (new upload or clear), reset the category
// filter so we don't end up showing an empty category the user didn't pick.
watch(setSignal, () => {
  resetCategory()
})

/**
 * Debounced auto-save of the loaded sets to localStorage. The 300ms delay
 * coalesces rapid uploads (e.g. dropping foundation.json then semantic.json
 * in quick succession) into a single write. Manual debounce via `setTimeout`
 * — no new dependency. The timer is cleared on unmount to avoid a write
 * after the component is gone.
 */
const SAVE_DEBOUNCE_MS = 300
let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(setSignal, () => {
  if (saveTimer !== null) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveState()
    saveTimer = null
  }, SAVE_DEBOUNCE_MS)
})

/**
 * First-mount restore, with the documented precedence:
 *
 *   1. **URL hash wins.** If the page was opened with a `#…` share hash,
 *      decode it and populate the slots from the hash. Skip localStorage.
 *      A teammate's shared link should override your last session.
 *   2. **localStorage fallback.** No hash → try restoring the last-saved
 *      session so a page reload picks up where you left off.
 *   3. **Empty.** Neither present → dropzones stay blank.
 *
 * The guard `setA.value !== null` defends against double-loading if some
 * future code path populates a slot before this effect runs.
 *
 * After a successful hash load, the hash is stripped via
 * `history.replaceState` so a refresh gives a clean URL — the loaded sets
 * now live in the session and will be persisted to localStorage by the
 * auto-save watch above.
 */
onMounted(() => {
  if (typeof window === 'undefined') return
  if (setA.value !== null) return

  // 1. Share-link hash.
  const hash = readFromUrl()
  if (hash !== null) {
    const result = loadFromHash(hash)
    if (result.loaded !== 'none') {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      )
      return
    }
    // Hash was present but didn't decode — fall through to localStorage.
  }

  // 2. localStorage.
  restoreFromStorage()
})

onUnmounted(() => {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
})
</script>

<template>
  <div class="dtv-app">
    <AppHeader />

    <main
      class="dtv-app__main"
      :style="{ gridTemplateColumns: `${sidebarWidth} 1fr` }"
    >
      <aside class="dtv-app__sidebar" aria-label="Categories">
        <Sidebar />
      </aside>

      <section class="dtv-app__content">
        <Toolbar />

        <Gallery :compare="isComparing" />

        <div v-if="!isComparing" class="dtv-app__validation">
          <ValidationPanel v-model:open="validationOpen" />
        </div>
      </section>
    </main>

    <!-- Inspector overlays everything when a browse-mode token is selected -->
    <Inspector />
    <!-- DiffInspector overlays everything when a compare-mode card is clicked -->
    <DiffInspector />
  </div>
</template>

<style scoped>
.dtv-app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.dtv-app__main {
  display: grid;
  /* grid-template-columns is bound inline via :style to the sidebarWidth
     computed from useSidebar. */
  flex: 1;
  min-height: 0;
}

.dtv-app__sidebar {
  border-right: 1px solid var(--dtv-color-border);
  background-color: var(--dtv-color-surface);
  overflow-y: auto;
}

/* Smooth width transition on collapse/expand, gated on reduced-motion
   preference. The Sidebar component owns its own internal padding in both
   expanded and collapsed states; the aside itself stays at padding 0 so
   the collapsed rail doesn't add visual chrome around the toggle. */
@media (prefers-reduced-motion: no-preference) {
  .dtv-app__main {
    transition: grid-template-columns 0.15s ease;
  }
}

.dtv-app__content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dtv-app__validation {
  padding: 0 var(--dtv-spacing-lg) var(--dtv-spacing-lg);
}

/* Responsive — hide sidebar under 900px (category filter on narrow
   viewports is a future enhancement; gallery shows "all" by default). */
@media (max-width: 900px) {
  .dtv-app__main {
    grid-template-columns: 1fr;
  }

  .dtv-app__sidebar {
    display: none;
  }
}
</style>
