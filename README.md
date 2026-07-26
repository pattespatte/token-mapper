# Design Token Mapper

A standalone, client-side web app to visually browse and compare [W3C design tokens](https://design-tokens.github.io/community-group/). Load one token set to explore it, or load two to see them side by side — matching, changed, missing, and extra tokens at a glance.

Everything runs in your browser. No backend, no database, no login, no telemetry. Token files are parsed locally and never leave your machine.

**Live demo:** <https://pattespatte.github.io/token-mapper/>

---

## What it does

- **Browse**: load one or more JSON files as a single token set; tokens are grouped by category (color, spacing, radius, typography, …) and rendered visually via type-specific renderers.
- **Compare**: load two sets and the gallery partitions every token path into four buckets — *matching*, *changed*, *missing in B*, *extra in B*. Filter by bucket.
- **Inspect**: click any token to see its full picture — type, description, resolved value, raw value, and the complete reference chain hop-by-hop.
- **Validate**: parse-time issues (invalid JSON, missing `$type`, dangling references, cycles) are surfaced in a validation panel.

The headline use case is a design system that builds on top of an upstream base design system — export both from Figma and instantly see where they've drifted.

---

## Supported format

The canonical format is the [W3C Design Tokens Format Module](https://design-tokens.github.io/community-group/format/) (DTCG). Tokens use the `$value`, `$type`, and `$description` properties, and reference each other with `{path.to.token}` aliases.

Example:

```json
{
  "color": {
    "indigo": {
      "500": { "$type": "color", "$value": "#6366f1" }
    },
    "accent": {
      "$type": "color",
      "$value": "{color.indigo.500}",
      "$description": "Primary accent for links and actions."
    }
  }
}
```

Style Dictionary, Tailwind configs, and generic nested JSON are **not** supported — convert to W3C DTCG first. Most modern token tooling can emit DTCG directly.

### Token types with dedicated renderers

| `$type` | Rendering |
|---|---|
| `color` | Swatch with hex / RGB / HSL labels; supports `#rgb`, `#rrggbb`, `#rrggbbaa` (alpha last per CSS), `rgb()` / `hsl()` / `oklch()`, and the W3C draft structured color object |
| `dimension` | Spacing tokens render as a width-proportional bar; radius tokens as a square with the value applied as `border-radius` |
| `typography` | Live sample text styled from the composite value (fontFamily, fontSize, fontWeight, lineHeight, letterSpacing) plus a spec list |
| anything else | Generic fallback: type label + JSON-pretty value |

### Multi-file token sets

A single token set may span multiple files whose references cross between them — the canonical `foundation.json` (primitive palette) + `semantic.json` (intent aliases) split that real design systems use. Uploads **append** to a slot, so the natural workflow is:

1. Drop `foundation.json` into the slot.
2. Drop `semantic.json` into the same slot.

Both files merge into one set before references are resolved, so a semantic token like `{color.gray.50}` correctly resolves to its definition in `foundation.json`. You can also select multiple files at once in the OS file picker (shift-click / ⌘-click) — same result. To start a slot over, click the ✕ clear button next to it.

The slot shows the accumulated filename list (with a tooltip of the full list when there are several) and the running token count, so it's always clear what's loaded.

---

## Exporting tokens from Figma

The app does not call the Figma API. Use a Figma plugin to export your design tokens as W3C DTCG JSON:

- [Tokens Studio](https://www.figma.com/community/plugin/843461159747178978/Tokens-Studio-for-Figma-) — the most widely used; exports DTCG directly via *Sync → Set API provider → Export to file* or the GitHub/GitLab sync.
- Your design system's own plugin, if it has one.

Save the exported JSON file(s) and drop them into either upload slot.

---

## Local development

Requires Node.js LTS (tested on Node 20+).

```bash
npm install
npm run dev      # http://localhost:5173/token-mapper/
```

The dev server serves at `/token-mapper/` to match the GitHub Pages base path. To serve from root locally (e.g. for testing in a different context):

```bash
BASE_PATH=/ npm run dev      # http://localhost:5173/
```

### Build & preview

```bash
npm run build     # type-check + production build to dist/
npm run preview   # serve the built dist/ locally
```

### Tests

```bash
npm test          # run the suite once (Vitest)
npm run test:watch
npm run coverage  # with V8 coverage
```

Tests cover the pure pipeline modules (`parse`, `validate`, `resolve`, `diff`) and a component smoke test for the upload Dropzone.

---

## Deployment

Deploys automatically to GitHub Pages via the workflow in `.github/workflows/deploy.yml` — every push to `main` builds and publishes. To deploy your own fork:

1. Fork the repo.
2. In **Settings → Pages**, set **Source** to *GitHub Actions* (one-time setup; the workflow handles the rest).
3. Update `base` in `vite.config.ts` to match your repo name (or set `BASE_PATH` at build time).
4. Push to `main`.

---

## Project structure

```
src/
├── types/             # Type definitions (no runtime code)
├── pipeline/          # Pure core: parse → validate → resolve → diff
├── renderers/         # Type → Vue component registry
├── components/        # UI shell and feature components
├── composables/       # Reactive state (useTokenSets, useDiff, useGallery)
├── data/demo/         # Bundled demo dataset
└── styles/            # Global stylesheet (the app's own design tokens)
tests/
├── pipeline/          # Unit tests for the pure core
└── components/        # Component smoke tests
```

The pipeline modules (`src/pipeline/`) are pure functions with no Vue dependency, so they're trivially unit-testable and reusable outside the UI.

---

## Contributing

Contributions welcome. The codebase is intentionally small and readable — the pipeline/UI separation makes most changes local. Please:

- Run `npm test` before submitting — the suite must pass.
- Keep the pipeline pure (no Vue imports in `src/pipeline/`).
- Follow the existing TypeScript strict conventions.

## License

[MIT](./LICENSE)
