<script setup lang="ts">
/**
 * TokenCard — browse-mode card: one token's visual + path + copy.
 *
 * Wraps a TokenVisual (renderer dispatch) with a footer showing the dotted
 * path and a copy-to-clipboard button. Emits `select` with the path when
 * activated (click / Enter / Space) so the parent can open the Inspector.
 *
 * For compare mode, see DiffCard — it composes two TokenVisuals (or one +
 * a placeholder) plus a DiffBadge.
 */

import { ref, onUnmounted } from 'vue'
import type { ResolvedToken } from '@/types/token'
import TokenVisual from './TokenVisual.vue'

const props = defineProps<{
  token: ResolvedToken
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

const copied = ref(false)
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

async function copyPath(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.token.path)
    copied.value = true
    if (copyResetTimer !== null) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      copied.value = false
      copyResetTimer = null
    }, 1200)
  } catch {
    // Clipboard API can fail in insecure contexts; fail silently.
  }
}

onUnmounted(() => {
  if (copyResetTimer !== null) clearTimeout(copyResetTimer)
})
</script>

<template>
  <article
    class="dtv-card"
    tabindex="0"
    :aria-label="`Token ${token.path}`"
    @click="emit('select', token.path)"
    @keydown.enter.prevent="emit('select', token.path)"
    @keydown.space.prevent="emit('select', token.path)"
  >
    <TokenVisual :token="token" />
    <div class="dtv-card__footer">
      <code class="dtv-card__path" :title="token.path">{{ token.path }}</code>
      <button
        type="button"
        class="dtv-card__copy"
        :aria-label="copied ? 'Path copied' : `Copy ${token.path}`"
        @click.stop="copyPath"
        @keydown.stop
      >
        {{ copied ? '✓' : '⧉' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.dtv-card {
  display: flex;
  flex-direction: column;
  gap: var(--dtv-spacing-sm);
  padding: var(--dtv-spacing-md);
  background-color: var(--dtv-color-surface);
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-md);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.dtv-card:hover,
.dtv-card:focus-visible {
  border-color: var(--dtv-color-accent);
  box-shadow: var(--dtv-shadow-card);
  outline: none;
}

.dtv-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dtv-spacing-xs);
}

.dtv-card__path {
  font-family: var(--dtv-font-family-mono);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-muted);
  word-break: break-all;
  line-height: 1.3;
}

.dtv-card__copy {
  flex-shrink: 0;
  padding: 2px var(--dtv-spacing-xs);
  font-size: var(--dtv-font-size-sm);
  color: var(--dtv-color-text-subtle);
  background: none;
  border: 1px solid var(--dtv-color-border);
  border-radius: var(--dtv-radius-sm);
  cursor: pointer;
  line-height: 1;
}

.dtv-card__copy:hover {
  color: var(--dtv-color-accent);
  border-color: var(--dtv-color-accent);
}
</style>
