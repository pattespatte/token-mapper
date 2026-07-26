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

import { ref, watch } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import Sidebar from '@/components/Sidebar.vue'
import Toolbar from '@/components/Toolbar.vue'
import Gallery from '@/components/Gallery.vue'
import ValidationPanel from '@/components/ValidationPanel.vue'
import Inspector from '@/components/Inspector.vue'
import { useTokenSets } from '@/composables/useTokenSets'
import { useGallery } from '@/composables/useGallery'
import { useSidebar } from '@/composables/useSidebar'

const { isComparing, setA, setB } = useTokenSets()
const { resetCategory } = useGallery()
const { sidebarWidth } = useSidebar()

const validationOpen = ref(false)

// When the browse set changes (new upload or clear), reset the category
// filter so we don't end up showing an empty category the user didn't pick.
watch(
  () => [setA.value?.label, setB.value?.label],
  () => {
    resetCategory()
  }
)
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
