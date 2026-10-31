import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RenderBlock } from '../src/blocks/registry'
import { PropertiesPanel } from '../src/editor/PropertiesPanel'
import { FooterBlock } from '../src/blocks/footer/FooterBlock'
import type { BlockConfig, BlockType } from '../src/blocks/types'

describe('unsupported blocks', () => {
  it.each(['constructor', 'toString', '__proto__', 'future-chart'])('shows a preservation notice for %s', type => {
    const block: BlockConfig = { id: 'unknown', type: type as BlockType, variant: 'custom', props: { retained: 'value' } }
    const html = renderToStaticMarkup(createElement(RenderBlock, { block }))
    expect(html).toContain(`Unsupported block: ${type}`)
    expect(html).toContain('data is preserved')
    expect(renderToStaticMarkup(createElement(PropertiesPanel, { block }))).toContain('No editable properties defined')
  })
})

describe('footer navigation', () => {
  it.each(['simple', 'multi-column', 'minimal'])('renders %s destinations even when legacy labels are absent', variant => {
    const block: BlockConfig = { id: 'footer', type: 'footer', variant, props: { navItems: [{ label: 'About', url: '/about' }] } }
    expect(renderToStaticMarkup(createElement(FooterBlock, { block }))).toContain('href="/about"')
  })
})
