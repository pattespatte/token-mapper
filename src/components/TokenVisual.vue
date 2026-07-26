<script setup lang="ts">
/**
 * TokenVisual — renderer dispatch + nothing else.
 *
 * Extracted from TokenCard so the compare-mode DiffCard can render the same
 * visual without duplicating the renderer-lookup logic. Just looks up the
 * right renderer for the token's $type and mounts it.
 *
 * No card chrome, no path label, no copy button — those belong to the
 * browse-mode TokenCard. This component is purely the visual preview.
 */

import { computed } from 'vue'
import { getRenderer } from '@/renderers/registry'
import type { ResolvedToken } from '@/types/token'

const props = defineProps<{
  token: ResolvedToken
}>()

const renderer = computed(() => getRenderer(props.token.type))
</script>

<template>
  <div class="dtv-visual">
    <component :is="renderer" :token="token" />
  </div>
</template>

<style scoped>
.dtv-visual {
  min-height: 64px;
}
</style>
