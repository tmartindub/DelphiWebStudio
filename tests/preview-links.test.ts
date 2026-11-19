import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeroBlock } from '../src/blocks/hero/HeroBlock'
import { CtaBlock } from '../src/blocks/cta/CtaBlock'
import type { BlockConfig } from '../src/blocks/types'

describe('preview link and image fidelity', () => {
  it.each(['centered', 'split', 'gradient', 'minimal'])('renders the configured hero link in %s', variant => {
    const block: BlockConfig = { id: 'hero', type: 'hero', variant, props: { headline: 'Welcome', subheadline: 'Hello', primaryCta: 'Read news', primaryCtaUrl: '/news' } }
    expect(renderToStaticMarkup(createElement(HeroBlock, { block }))).toContain('href="/news"')
  })

  it('shows the configured image in the split hero preview', () => {
    const block: BlockConfig = { id: 'hero', type: 'hero', variant: 'split', props: { headline: 'Welcome', subheadline: '', primaryCta: '', heroImage: 'assets/hero.png' } }
    expect(renderToStaticMarkup(createElement(HeroBlock, { block }))).toContain('src="assets/hero.png"')
  })

  it.each(['simple', 'split'])('renders the configured CTA link in %s', variant => {
    const block: BlockConfig = { id: 'cta', type: 'cta', variant, props: { headline: 'Hello', buttonText: 'Contact', buttonUrl: '/contact' } }
    expect(renderToStaticMarkup(createElement(CtaBlock, { block }))).toContain('href="/contact"')
  })
})
