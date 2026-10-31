import { describe, expect, it } from 'vitest'
import { buildTemplate, getTemplateForPrompt, templateMeta } from '../src/lib/templates'
import { defaultConfig } from '../src/store/configStore'

describe('starter sites', () => {
  it('starts blank without injected business, pricing, advertising or contact content', () => {
    expect(defaultConfig.blocks).toEqual([])
    expect(defaultConfig.pages?.[0].blocks).toEqual([])
  })

  it('provides all eight editable informational starters without commerce or invented details', () => {
    expect(templateMeta.map(template => template.id)).toEqual(['personal', 'portfolio', 'community', 'church', 'school', 'business', 'documentation', 'blog'])
    const bodies = new Set<string>()
    for (const template of templateMeta) {
      const config = buildTemplate(template.id, 'Example')
      expect(config.blocks.map(block => block.type)).toEqual(['hero', 'content'])
      expect(JSON.stringify(config)).not.toMatch(/pricing|subscribe|advertis|reservation|premium|checkout/i)
      expect(config.blocks[0].props.headline).toBe('Example')
      bodies.add(config.blocks[1].props.body as string)
    }
    expect(bodies.size).toBe(8)
  })

  it('selects a local starter from a description without inventing business facts', () => {
    const config = getTemplateForPrompt('Church website')
    expect(config.blocks[0].props.subheadline).toBe('Share church information')
    expect(config.blocks[1].props.body).toContain('## About our church')
  })
})
