import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { BlockWrapper } from '../src/blocks/BlockWrapper'
import { RenderBlock } from '../src/blocks/registry'
import type { BlockConfig } from '../src/blocks/types'
import { PropertiesPanel } from '../src/editor/PropertiesPanel'
import { exportSiteToHTML } from '../src/lib/export-html'
import { createProjectFile, parseProjectFile, serializeProjectFile } from '../src/project/project-file'
import { useEditorStore } from '../src/store/editorStore'

const colors = { buttonBackgroundColor: '#eadcc5', buttonTextColor: '#18344b', buttonBorderColor: '#845f2e' }
const examples: BlockConfig[] = [
  ...['default', 'centered'].map(variant => ({ id: `navbar-${variant}`, type: 'navbar' as const, variant, props: { ctaText: 'Visit', ctaUrl: '/visit' } })),
  ...['centered', 'split', 'gradient', 'minimal'].map(variant => ({ id: `hero-${variant}`, type: 'hero' as const, variant, props: { headline: 'Welcome', subheadline: '', primaryCta: 'Visit', primaryCtaUrl: '/visit', secondaryCta: 'Read', secondaryCtaUrl: '/read' } })),
  ...['simple', 'split'].map(variant => ({ id: `cta-${variant}`, type: 'cta' as const, variant, props: { headline: 'Visit', buttonText: 'Directions', buttonUrl: 'https://example.com' } })),
  { id: 'footer', type: 'footer', variant: 'resources', props: { resourceButtons: [{ label: 'Visit', url: '/visit' }] } },
  ...['cards', 'comparison'].map(variant => ({ id: `pricing-${variant}`, type: 'pricing' as const, variant, props: { title: 'Plans' } })),
  { id: 'contact', type: 'contact', variant: 'default', props: { recipientEmail: 'test@nowhere.com' } },
  { id: 'newsletter', type: 'newsletter', variant: 'default', props: {} },
  { id: 'calendar', type: 'calendar', variant: 'default', props: { events: [] } },
  { id: 'faq', type: 'faq', variant: 'accordion', props: { items: [{ question: 'When?', answer: 'Today.' }] } },
]

describe('website button colors', () => {
  afterEach(() => { useEditorStore.getInitialState().selectedSectionObject = null })

  it.each(examples)('styles built-in $id buttons in Preview and export', example => {
    const block = { ...example, props: { ...example.props, ...colors, textColor: '#666666' } }
    const preview = renderToStaticMarkup(createElement(BlockWrapper, { block, isSelected: false, onSelect: () => {} }, createElement(RenderBlock, { block })))
    const exported = exportSiteToHTML({ name: 'Button test', blocks: [block] })
    for (const html of [preview, exported]) {
      expect(html).toContain('data-ws-block-button')
      expect(html).toContain('background-color:#eadcc5!important')
      expect(html).toContain('color:#18344b!important')
      expect(html).toContain('border-color:#845f2e!important')
      expect(html).toContain(':not([data-ws-block-button]):not([data-ws-object-button])')
    }
  })

  it('retains separate colors on linked and unlinked buttons in every section after saving', () => {
    const props = Object.fromEntries([1, 2, 3, 4].map(section => [`section${section}Objects`, [
      { id: `button-${section}`, type: 'button', text: 'Get Directions', url: section % 2 ? 'https://example.com' : '', backgroundColor: '#eadcc5', textColor: '#18344b', borderColor: '#845f2e', x: 5, y: 20, width: 35, height: 50, layer: 1 },
    ]]))
    const config = { name: 'Buttons', blocks: [{ id: 'content', type: 'content' as const, variant: 'prose', props: { ...props, sectionCount: 4 } }] }
    const reopened = parseProjectFile(serializeProjectFile(createProjectFile(config, 'buttons'))).project.config
    expect(reopened.blocks[0].props).toEqual(config.blocks[0].props)
    const html = exportSiteToHTML(reopened)
    expect(html.match(/data-ws-object-button/g)?.length).toBe(4)
    expect(html.match(/background-color:#eadcc5;color:#18344b;border-color:#845f2e/g)?.length).toBe(4)
  })

  it('offers fill and outline controls for an existing button that has no new color properties', () => {
    const block = { id: 'old', type: 'content' as const, variant: 'prose', props: { section1Objects: [{ id: 'old-button', type: 'button', text: 'Visit', x: 0, y: 0, width: 30, height: 50, layer: 1 }] } }
    useEditorStore.getInitialState().selectedSectionObject = { blockId: block.id, section: 1, id: 'old-button' }
    const html = renderToStaticMarkup(createElement(PropertiesPanel, { block }))
    expect(html).toContain('Choose button background color')
    expect(html).toContain('Choose button outline color')
    expect(html).toContain('Use transparent background')
    expect(html).toContain('Match outline to text')
    expect(block.props.section1Objects[0]).not.toHaveProperty('backgroundColor')
  })

  it('leaves legacy button appearance alone and rejects invalid style values', () => {
    const block = { ...examples[0], props: { ...examples[0].props, buttonBackgroundColor: '#fff;display:none', buttonTextColor: 'url(https://example.com)', buttonBorderColor: 'red' } }
    const html = exportSiteToHTML({ name: 'Legacy', blocks: [block] })
    expect(html).not.toContain('display:none!important')
    expect(html).not.toContain('color:url(')
    expect(html).not.toContain('border-color:red')
    expect(html).toContain('bg-green text-black')
  })
})
