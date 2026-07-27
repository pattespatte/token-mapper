import { describe, expect, it } from 'vitest'
import { getRenderer } from '@/renderers/registry'
import ColorSwatch from '@/renderers/ColorSwatch.vue'
import DimensionBlock from '@/renderers/DimensionBlock.vue'
import TypographySample from '@/renderers/TypographySample.vue'
import ShadowPreview from '@/renderers/ShadowPreview.vue'
import BorderPreview from '@/renderers/BorderPreview.vue'
import GradientStrip from '@/renderers/GradientStrip.vue'
import GenericToken from '@/renderers/GenericToken.vue'

describe('renderer registry', () => {
  it('maps color → ColorSwatch', () => {
    expect(getRenderer('color')).toBe(ColorSwatch)
  })

  it('maps dimension → DimensionBlock', () => {
    expect(getRenderer('dimension')).toBe(DimensionBlock)
  })

  it('maps typography → TypographySample', () => {
    expect(getRenderer('typography')).toBe(TypographySample)
  })

  it('maps shadow → ShadowPreview (Tier 1)', () => {
    expect(getRenderer('shadow')).toBe(ShadowPreview)
  })

  it('maps border → BorderPreview (Tier 1)', () => {
    expect(getRenderer('border')).toBe(BorderPreview)
  })

  it('maps gradient → GradientStrip (Tier 1)', () => {
    expect(getRenderer('gradient')).toBe(GradientStrip)
  })

  it('falls back to GenericToken for unknown types', () => {
    expect(getRenderer('opacity')).toBe(GenericToken)
    expect(getRenderer('mystery-type')).toBe(GenericToken)
  })

  it('falls back to GenericToken when type is undefined', () => {
    expect(getRenderer(undefined)).toBe(GenericToken)
  })
})
