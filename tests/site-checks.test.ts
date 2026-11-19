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

  it('finds unconfigured media and image placeholders without flagging unused image fields', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push(
      { id: 'image', type: 'image', variant: 'hero-image', props: {} },
      { id: 'grid', type: 'image', variant: 'grid', props: { images: [{ src: '', alt: '' }, { src: 'https://example.test/photo.png', alt: 'Photo' }] } },
      { id: 'gallery', type: 'gallery', variant: 'grid', props: {} },
      { id: 'pdf', type: 'pdfViewer', variant: 'default', props: {} },
      { id: 'video', type: 'video', variant: 'youtube', props: { url: '' } },
    )
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy)
    expect(issues.map(issue => issue.blockId)).toEqual(['image', 'grid', 'gallery', 'pdf', 'video'])
    expect(issues.find(issue => issue.blockId === 'grid')?.message).toContain('Image 1')
    copy.pages![0].blocks[5].props.url = 'https://www.youtube.com/watch?v=abcdefghijk'
    expect(checkSite(copy).some(issue => issue.blockId === 'video')).toBe(false)
  })

  it('does not claim to verify external links or anchors', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks[0].props.primaryCtaUrl = 'https://example.test/'
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy)).toEqual([])
    copy.pages![0].blocks[0].props.primaryCtaUrl = '#section'
    expect(checkSite(copy)).toEqual([])
  })

  it('reports missing or draft destinations and unsafe protocols in content links', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'text', type: 'content', variant: 'prose', props: { body: '[Missing](/missing) [Draft](/news#top) [Unsafe](javascript:alert) [Web](https://example.test)' } })
    copy.pages![1].webstudioArticle = { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' }
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy).filter(issue => issue.blockId === 'text')
    expect(issues).toHaveLength(3)
    expect(issues.some(issue => issue.message.includes('does not match'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('draft article'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('unsupported link address'))).toBe(true)
  })

  it('flags explicitly empty blocks that need content', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'team', type: 'team', variant: 'grid', props: { members: [] } })
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy).find(issue => issue.blockId === 'team')?.message).toContain('no entries')
  })

  it('warns about nonfunctional legacy navigation without altering it', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'nav', type: 'navbar', variant: 'default', props: { links: ['About'], ctaText: 'Join' } })
    copy.pages![0].blocks.push({ id: 'footer', type: 'footer', variant: 'multi-column', props: { links: [], columns: [{ title: 'Pages', links: ['Contact'] }] } })
    copy.blocks = copy.pages![0].blocks
    const before = structuredClone(copy)
    const issues = checkSite(copy)
    expect(issues.filter(issue => issue.blockId === 'nav')).toHaveLength(2)
    expect(issues.filter(issue => issue.blockId === 'footer')).toHaveLength(1)
    expect(copy).toEqual(before)
    copy.pages![0].blocks[1].props.ctaUrl = '/news'
    expect(checkSite(copy).filter(issue => issue.blockId === 'nav')).toHaveLength(1)
    copy.pages![0].blocks[1].props = { links: [], ctaText: '' }
    copy.pages![0].blocks[2].props = { links: [], columns: [{ title: 'Pages', links: [] }] }
    expect(checkSite(copy)).toEqual([])
  })
})
