/**
 * exportDiff — pure functions that serialise a `DiffResult` into
 * shareable report formats (Markdown for PR comments, JSON for tooling).
 *
 * Both functions are pure: same inputs → same output, no side effects, no
 * Vue, no I/O. The ExportMenu component calls them and then handles the
 * actual download / clipboard write separately.
 *
 * Markdown design (PR-friendly):
 *   - H1 with set A vs set B labels.
 *   - One-line counts summary.
 *   - `## Changed` — path + per-token `explanation.summary`, capped at
 *     CHANGED_LIST_CAP entries with a `… and N more` trailer.
 *   - `## Missing in B` — bare path list (one per line).
 *   - `## Extra in B` — bare path list.
 *   - `## Matching` — collapsed to just the count, no list (a 5000-token
 *     diff would otherwise drown the signal).
 *
 * JSON design (machine-readable):
 *   - Mirrors the Markdown structure but as data.
 *   - `matching` body is intentionally absent (count only) — listing
 *     thousands of identical tokens helps no tooling pipeline.
 */

import type { DiffResult } from '@/types/diff'

/** Metadata passed in by the caller; both fields used in titles and headers. */
export interface ReportMeta {
  setALabel: string
  setBLabel: string
  /** When the report was generated. Caller passes `new Date()` at click time. */
  generatedAt: Date
}

/** Cap on the number of changed-token rows in the Markdown report body. */
const CHANGED_LIST_CAP = 50

/* --------------------------------- Markdown ------------------------------- */

/**
 * Render a Markdown diff report string. Pure; deterministic given inputs.
 */
export function toMarkdownDiffReport(diff: DiffResult, meta: ReportMeta): string {
  const lines: string[] = []
  const stamp = formatTimestamp(meta.generatedAt)

  lines.push(`# Diff: ${meta.setALabel} vs ${meta.setBLabel}`)
  lines.push('')
  lines.push(`_Generated ${stamp}_`)
  lines.push('')

  // Counts summary line.
  const total =
    diff.matching.length + diff.changed.length + diff.missing.length + diff.extra.length
  lines.push(
    `**${total}** token${total === 1 ? '' : 's'} compared — ` +
      `${diff.matching.length} matching · ${diff.changed.length} changed · ` +
      `${diff.missing.length} missing in B · ${diff.extra.length} extra in B.`
  )
  lines.push('')

  // Changed (with explanation summaries).
  lines.push('## Changed')
  lines.push('')
  if (diff.changed.length === 0) {
    lines.push('_No changed tokens._')
    lines.push('')
  } else {
    for (const td of diff.changed.slice(0, CHANGED_LIST_CAP)) {
      const summary = td.explanation?.summary ?? ''
      const summarySuffix = summary !== '' ? ` — \`${summary}\`` : ''
      lines.push(`- \`${td.path}\`${summarySuffix}`)
    }
    const omitted = diff.changed.length - CHANGED_LIST_CAP
    if (omitted > 0) {
      lines.push("")
      lines.push(`_… and ${omitted} more changed token${omitted === 1 ? '' : 's'}._`)
      lines.push('')
    } else {
      lines.push('')
    }
  }

  // Missing in B (bare path list).
  lines.push('## Missing in B')
  lines.push('')
  if (diff.missing.length === 0) {
    lines.push('_No missing tokens._')
    lines.push('')
  } else {
    for (const td of diff.missing) {
      lines.push(`- \`${td.path}\``)
    }
    lines.push('')
  }

  // Extra in B (bare path list).
  lines.push('## Extra in B')
  lines.push('')
  if (diff.extra.length === 0) {
    lines.push('_No extra tokens._')
    lines.push('')
  } else {
    for (const td of diff.extra) {
      lines.push(`- \`${td.path}\``)
    }
    lines.push('')
  }

  // Matching (count only — listing thousands of identical tokens is noise).
  lines.push('## Matching')
  lines.push('')
  lines.push(`_${diff.matching.length} matching token${diff.matching.length === 1 ? '' : 's'} (omitted from report)._`)
  lines.push('')

  return lines.join('\n')
}

/* ----------------------------------- JSON --------------------------------- */

/**
 * Render a JSON diff report string. Pretty-printed (2-space indent) for
 * human review; `matching` body intentionally absent (count only).
 *
 * Caller-supplied `generatedAt` is serialised via `.toISOString()` for
 * stable, parseable output.
 */
export function toJsonDiffReport(diff: DiffResult, meta: ReportMeta): string {
  const report = {
    generatedAt: meta.generatedAt.toISOString(),
    setA: meta.setALabel,
    setB: meta.setBLabel,
    counts: {
      matching: diff.matching.length,
      changed: diff.changed.length,
      missing: diff.missing.length,
      extra: diff.extra.length,
    },
    // `changed` includes the explainer summary so tooling can surface the
    // headline diff per token without recomputing. before/after resolved
    // values are intentionally omitted — too noisy at scale; tooling that
    // needs them should consume the source token files directly.
    changed: diff.changed.map((td) => ({
      path: td.path,
      summary: td.explanation?.summary ?? null,
    })),
    missing: diff.missing.map((td) => ({ path: td.path })),
    extra: diff.extra.map((td) => ({ path: td.path })),
  }
  return JSON.stringify(report, null, 2)
}

/* --------------------------------- helpers -------------------------------- */

/**
 * Format a timestamp for the Markdown header: `2026-07-26 14:03 UTC`.
 * Falls back to ISO if UTC helpers are unavailable (defensive — they're
 * standard but jsdom / older runtimes can be quirky).
 */
function formatTimestamp(d: Date): string {
  try {
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`
  } catch {
    return d.toISOString()
  }
}
