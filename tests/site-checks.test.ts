import { describe, expect, it } from 'vitest'
import { checkSite } from '../src/project/site-checks'
import type { BlockConfig, SiteConfig } from '../src/blocks/types'

const hero: BlockConfig = { id: 'hero', type: 'hero', variant: 'minimal', props: { headline: 'Welcome', primaryCta: 'News', primaryCtaUrl: '/news?source=home#top' } }
const config: SiteConfig = { name: 'Community', pages: [
  { id: 'home', name: 'Home', path: '/', blocks: [hero] },
  { id: 'news', name: 'News', path: '/news', blocks: [] },
], blocks: [hero] }

describe('local site checks', () => {
  it('accepts a known page link with a query and anchor without changing the project', () => {
    const before = structuredClone(config)
    expect(checkSite(config)).toEqual([])
    expect(config).toEqual(before)
  })

  it('reports missing and draft page destinations and unconfigured link labels', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks[0].props.primaryCtaUrl = '/missing'
    copy.pages![0].blocks.push({ id: 'banner', type: 'banner', variant: 'bar', props: { linkText: 'Read', linkUrl: '/news' } })
    copy.pages![0].blocks.push({ id: 'cta', type: 'cta', variant: 'simple', props: { buttonText: 'Contact', buttonUrl: '' } })
    copy.pages![1].webstudioArticle = { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' }
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy)
    expect(issues.some(issue => issue.message.includes('does not match a site page'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('draft article'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('no link destination'))).toBe(true)
  })

  it('reports missing image descriptions and unconfigured forms without claiming compliance', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'image', type: 'image', variant: 'hero-image', props: { src: 'https://example.test/a.png', alt: '' } })
    copy.pages![0].blocks.push({ id: 'contact', type: 'contact', variant: 'form', props: { recipientEmail: 'invalid' } })
    copy.pages![0].blocks.push({ id: 'newsletter', type: 'newsletter', variant: 'default', props: {} })
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy)
    expect(issues.map(issue => issue.blockId)).toEqual(['image', 'contact', 'newsletter'])
    expect(issues[0].message).toContain('decorative')
    expect(issues[1].message).toContain('disabled')
  })

  it('does not claim to verify external links or anchors', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks[0].props.primaryCtaUrl = 'https://example.test/'
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy)).toEqual([])
    copy.pages![0].blocks[0].props.primaryCtaUrl = '#section'
    expect(checkSite(copy)).toEqual([])
  })
})
