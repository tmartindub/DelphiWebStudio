import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RenderBlock } from '../src/blocks/registry'
import { PropertiesPanel } from '../src/editor/PropertiesPanel'
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
