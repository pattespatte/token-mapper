/**
 * Renderer registry — maps a token's `$type` to the Vue component that
 * visualises it.
 *
 * Add a new renderer by calling `registerRenderer` with the type and the
 * component. Unknown or missing types fall back to `GenericToken`, so the
 * gallery never breaks on a token type we haven't built a dedicated renderer
 * for yet (e.g. opacity, duration, fontFamily — future work).
 *
 * The registry is module-scoped and mutable so future plugin/extension work
 * could add renderers at runtime; for now it is populated once below.
 */

import type { Component } from 'vue'
import type { DtcgType } from '@dtcg-mapper/core'
import BorderPreview from './BorderPreview.vue'
import ColorSwatch from './ColorSwatch.vue'
import DimensionBlock from './DimensionBlock.vue'
import GenericToken from './GenericToken.vue'
import GradientStrip from './GradientStrip.vue'
import ShadowPreview from './ShadowPreview.vue'
import TypographySample from './TypographySample.vue'

/**
 * Internal map keyed by `$type`. Keys are strings (DtcgType is an open union)
 * so unknown types can be registered too.
 */
const registry = new Map<string, Component>()

/**
 * Register a renderer for a token type. Overrides any previous registration
 * for the same type.
 */
export function registerRenderer(type: DtcgType, component: Component): void {
  registry.set(type, component)
}

/**
 * Look up the renderer for a token type. Returns `GenericToken` when the type
 * is unknown, missing, or has no dedicated renderer registered.
 */
export function getRenderer(type: DtcgType | undefined): Component {
  if (type === undefined) return GenericToken
  return registry.get(type) ?? GenericToken
}

// ---- Built-in renderer registrations -------------------------------------
// Keep this list in sync with the type-specific components we ship.
registerRenderer('color', ColorSwatch)
registerRenderer('dimension', DimensionBlock)
registerRenderer('typography', TypographySample)
registerRenderer('shadow', ShadowPreview)
registerRenderer('border', BorderPreview)
registerRenderer('gradient', GradientStrip)
