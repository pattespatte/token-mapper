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
import { useTheme } from '@/composables/useTheme'

const { isComparing, setA, setB } = useTokenSets()
const { resetCategory } = useGallery()
const { sidebarWidth } = useSidebar()
const { readFromUrl, loadFromHash } = useShare()
const { restoreFromStorage, saveState } = usePersistence()
const { theme, initThemeFromStorage } = useTheme()

/**
 * Per-set validation-panel expand state. Independent so each set's panel
 * can be opened/closed on its own — in compare mode the two side-by-side
 * panels don't force-couple. In browse mode only the loaded set's panel
 * renders, so the other ref is simply unused.
 */
const validationOpenA = ref(false)
const validationOpenB = ref(false)

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
 * Reflect the theme mode onto the `<html>` element.
 *
 *   - `'light'` / `'dark'` → set `data-theme`, forcing that palette over the
 *     OS preference. `immediate: true` applies the stored choice on first
 *     render so there's no flash of the wrong palette.
 *   - `'system'` → *delete* the `data-theme` attribute, handing control to
 *     the `@media (prefers-color-scheme: dark)` branch in `tokens.css`. The
 *     media query re-evaluates automatically when the OS theme changes, so
 *     system mode follows the OS live with no JS listener required.
 *
 * The default mode is `'system'`, meaning a first-time visitor (no stored
 * choice) renders with no attribute — the CSS media query applies on the very
 * first paint, before this watcher even runs, so there's no flash for them.
 */
watch(
  theme,
  (t) => {
    if (typeof document === 'undefined') return
    if (t === 'system') {
      delete document.documentElement.dataset['theme']
    } else {
      document.documentElement.dataset['theme'] = t
    }
  },
  { immediate: true }
)

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

  // Apply persisted theme choice before any rendering work — the watcher
  // above already ran once with the default 'system', this corrects it from
  // storage if the user had chosen light or dark.
  initThemeFromStorage()

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
  <div class="dtm-app">
    <AppHeader />

    <main
      class="dtm-app__main"
      :style="{ gridTemplateColumns: `${sidebarWidth} 1fr` }"
    >
      <aside class="dtm-app__sidebar" aria-label="Categories">
        <Sidebar />
      </aside>

      <section class="dtm-app__content">
        <Toolbar />

        <Gallery :compare="isComparing" />

        <!--
          Validation panels — one per loaded set. Browse mode (a single set
          loaded) renders just that set's panel. Compare mode renders A and B
          side by side, so each set's issues read independently. The panel is
          always present once a set is loaded; an empty set simply renders no
          panel (no slot to validate).
        -->
        <div
          v-if="setA !== null || setB !== null"
          class="dtm-app__validation"
          :class="{ 'dtm-app__validation--split': isComparing }"
        >
          <ValidationPanel
            v-if="setA !== null"
            set-id="A"
            v-model:open="validationOpenA"
          />
          <ValidationPanel
            v-if="setB !== null && isComparing"
            set-id="B"
            v-model:open="validationOpenB"
          />
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
.dtm-app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.dtm-app__main {
  display: grid;
  /* grid-template-columns is bound inline via :style to the sidebarWidth
     computed from useSidebar. */
  flex: 1;
  min-height: 0;
}

.dtm-app__sidebar {
  border-right: 1px solid var(--dtm-color-border);
  background-color: var(--dtm-color-surface);
  overflow-y: auto;
}

/* Smooth width transition on collapse/expand, gated on reduced-motion
   preference. The Sidebar component owns its own internal padding in both
   expanded and collapsed states; the aside itself stays at padding 0 so
   the collapsed rail doesn't add visual chrome around the toggle. */
@media (prefers-reduced-motion: no-preference) {
  .dtm-app__main {
    transition: grid-template-columns 0.15s ease;
  }
}

.dtm-app__content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dtm-app__validation {
  padding: 0 var(--dtm-spacing-lg) var(--dtm-spacing-lg);
}

/* Compare mode: A | B side by side, mirroring the gallery's two columns.
   Each panel flexes equally so they share the row; the gap matches the
   gallery's compare layout. */
.dtm-app__validation--split {
  display: flex;
  gap: var(--dtm-spacing-md);
  align-items: flex-start;
}

.dtm-app__validation--split > * {
  flex: 1 1 0;
  min-width: 0;
}

/* On narrow viewports the two panels stack rather than squeeze — a 50/50
   split is unreadable below ~600px. */
@media (max-width: 600px) {
  .dtm-app__validation--split {
    flex-direction: column;
  }
}

/* Responsive — hide sidebar under 900px (category filter on narrow
   viewports is a future enhancement; gallery shows "all" by default). */
@media (max-width: 900px) {
  .dtm-app__main {
    grid-template-columns: 1fr;
  }

  .dtm-app__sidebar {
    display: none;
  }
}
</style>
