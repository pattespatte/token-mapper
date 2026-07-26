/**
 * Browser download helper — trigger a client-side file download via a Blob
 * URL and a programmatically-clicked `<a download>`.
 *
 * Kept out of the Vue component layer so the I/O concern stays separable
 * and unit-testable. No `file-saver` dependency — ~10 lines is enough and
 * works in all evergreen browsers (Safari's quirkiness around `download`
 * is the main reason to verify in Phase 8 manual testing).
 */

/** Allowlist for filename components; everything else gets replaced with `-`. */
const DISALLOWED_CHARS = /[^a-zA-Z0-9-_]/g

/**
 * Trigger a browser download of `content` as `filename`.
 *
 * Side-effecting: creates a temporary Blob, object URL, and `<a>` element,
 * clicks it, then revokes the URL. Returns void — there's no signal back
 * for "download started" because the browser doesn't expose one.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    // Some browsers require the anchor to be in the document to trigger
    // the click handler for downloads. Append off-screen, click, remove.
    a.style.position = 'fixed'
    a.style.left = '-9999px'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    // Revoke on the next tick so the click has a chance to read the URL.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/**
 * Sanitise an arbitrary string into a filename-safe component. Replaces
 * every char outside `[a-zA-Z0-9-_]` with `-`, collapses runs of dashes,
 * trims leading/trailing dashes, and falls back to `fallback` (default
 * `'token-mapper-diff'`) when the result is empty.
 */
export function sanitizeFilename(
  input: string,
  fallback = 'token-mapper-diff'
): string {
  const cleaned = input.replace(DISALLOWED_CHARS, '-')
  const collapsed = cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '')
  return collapsed.length > 0 ? collapsed : fallback
}
