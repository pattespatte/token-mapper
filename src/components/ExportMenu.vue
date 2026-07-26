<script setup lang="ts">
/**
 * ExportMenu — compare-mode export buttons.
 *
 * Four sibling buttons (decision #8 in the PRD: simpler and more
 * discoverable than a dropdown for a 2-format × 2-destination matrix):
 *
 *   - Export MD     → download Markdown report
 *   - Copy MD       → copy Markdown report to clipboard
 *   - Export JSON   → download JSON diff
 *   - Copy JSON     → copy JSON diff to clipboard
 *
 * Reads the live `diff` from `useDiff` and the set labels from
 * `useTokenSets`, computes the report string via the pure `exportDiff`
 * module, then either triggers a Blob download (`downloadTextFile`) or a
 * clipboard write (via the shared `useClipboard` composable).
 *
 * Disabled when there's no diff (no comparing). The parent Gallery gates
 * the whole component with `v-if="compare"` so we only render in compare
 * mode anyway, but the guard makes the component robust to misuse.
 */

import { computed } from 'vue'
import { useDiff } from '@/composables/useDiff'
import { useTokenSets } from '@/composables/useTokenSets'
import { useClipboard } from '@/composables/useClipboard'
import {
  toMarkdownDiffReport,
  toJsonDiffReport,
  type ReportMeta,
} from '@/pipeline/exportDiff'
import { downloadTextFile, sanitizeFilename } from '@/utils/download'

const { diff } = useDiff()
const { setA, setB } = useTokenSets()

// Two independent clipboard slots so each Copy button shows its own
// "Copied!" feedback without the other resetting.
const mdClipboard = useClipboard()
const jsonClipboard = useClipboard()

const disabled = computed(() => diff.value === null)

/** Build the ReportMeta object both formatters need. */
function meta(): ReportMeta {
  return {
    setALabel: setA.value?.label ?? 'set-A',
    setBLabel: setB.value?.label ?? 'set-B',
    generatedAt: new Date(),
  }
}

/** Build the Markdown report from the current diff. */
function markdownContent(): string {
  const d = diff.value
  if (d === null) return ''
  return toMarkdownDiffReport(d, meta())
}

/** Build the JSON report from the current diff. */
function jsonContent(): string {
  const d = diff.value
  if (d === null) return ''
  return toJsonDiffReport(d, meta())
}

/** Sanitised filename stem: `token-mapper-diff-<setA>-vs-<setB>`. */
function filenameStem(): string {
  const a = sanitizeFilename(setA.value?.label ?? 'set-A')
  const b = sanitizeFilename(setB.value?.label ?? 'set-B')
  return `token-mapper-diff-${a}-vs-${b}`
}

async function exportMarkdown(): Promise<void> {
  if (disabled.value) return
  downloadTextFile(`${filenameStem()}.md`, markdownContent(), 'text/markdown')
}

async function copyMarkdown(): Promise<void> {
  if (disabled.value) return
  await mdClipboard.copy(markdownContent())
}

async function exportJson(): Promise<void> {
  if (disabled.value) return
  downloadTextFile(`${filenameStem()}.json`, jsonContent(), 'application/json')
}

async function copyJson(): Promise<void> {
  if (disabled.value) return
  await jsonClipboard.copy(jsonContent())
}
</script>

<template>
  <div class="dtv-export-menu" role="group" aria-label="Export comparison report">
    <button
      type="button"
      class="dtv-export-menu__button dtv-export-menu__button--primary"
      :disabled="disabled"
      @click="exportMarkdown"
    >
      Export MD
    </button>
    <button
      type="button"
      class="dtv-export-menu__button"
      :disabled="disabled"
      :aria-label="mdClipboard.copied.value ? 'Markdown copied' : 'Copy Markdown report to clipboard'"
      @click="copyMarkdown"
    >
      {{ mdClipboard.copied.value ? '✓' : 'Copy MD' }}
    </button>
    <button
      type="button"
      class="dtv-export-menu__button"
      :disabled="disabled"
      @click="exportJson"
    >
      Export JSON
    </button>
    <button
      type="button"
      class="dtv-export-menu__button"
      :disabled="disabled"
      :aria-label="jsonClipboard.copied.value ? 'JSON copied' : 'Copy JSON report to clipboard'"
      @click="copyJson"
    >
      {{ jsonClipboard.copied.value ? '✓' : 'Copy JSON' }}
    </button>
  </div>
</template>

<style scoped>
.dtv-export-menu {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--dtv-spacing-xs);
  align-items: center;
}

.dtv-export-menu__button {
  padding: var(--dtv-spacing-xs) var(--dtv-spacing-sm);
  font-size: var(--dtv-font-size-sm);
  font-weight: var(--dtv-font-weight-medium);
  color: var(--dtv-color-text);
  background-color: var(--dtv-color-surface);
  border: 1px solid var(--dtv-color-border-strong);
  border-radius: var(--dtv-radius-md);
  cursor: pointer;
}

.dtv-export-menu__button:hover:not(:disabled) {
  background-color: var(--dtv-color-surface-muted);
}

.dtv-export-menu__button:focus-visible {
  outline: 2px solid var(--dtv-color-accent);
  outline-offset: 2px;
}

.dtv-export-menu__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Primary "Export MD" gets the accent treatment so the most-common action
   stands out from the three secondary buttons. */
.dtv-export-menu__button--primary {
  color: var(--dtv-color-bg);
  background-color: var(--dtv-color-accent);
  border-color: var(--dtv-color-accent);
}

.dtv-export-menu__button--primary:hover:not(:disabled) {
  filter: brightness(1.1);
}
</style>
