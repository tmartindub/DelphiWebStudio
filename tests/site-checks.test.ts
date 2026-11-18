import { describe, expect, it } from 'vitest'
import { checkSite } from '../src/project/site-checks'
import type { BlockConfig, SiteConfig } from '../src/blocks/types'
import { exportSiteToHTML } from '../src/lib/export-html'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FooterBlock } from '../src/blocks/footer/FooterBlock'
import { ImageBlock } from '../src/blocks/image/ImageBlock'

const hero: BlockConfig = { id: 'hero', type: 'hero', variant: 'minimal', props: { headline: 'Welcome', primaryCta: 'News', primaryCtaUrl: '/news?source=home#top' } }
const config: SiteConfig = { name: 'Community', pages: [
  { id: 'home', name: 'Home', path: '/', blocks: [hero] },
  { id: 'news', name: 'News', path: '/news', blocks: [{ id: 'news-section', type: 'content', variant: 'prose', props: { anchorName: 'headlines' } }] },
], blocks: [hero] }

describe('local site checks', () => {
  it('reports duplicate anchors, missing placed-image descriptions, and heading gaps', () => {
    const copy = structuredClone(config)
    const content: BlockConfig = { id: 'content', type: 'content', variant: 'prose', props: {
      body: '### Skipped heading', anchorName: 'repeat',
      section1Objects: [{ id: 'photo', type: 'image', anchorName: 'repeat', src: 'assets/photo.png' }],
    } }
    copy.pages![0].blocks.push(content)
    copy.blocks = copy.pages![0].blocks
    const messages = checkSite(copy, undefined, true).filter(issue => issue.pageId === 'home').map(issue => issue.message)
    expect(messages).toEqual(expect.arrayContaining([
      expect.stringContaining('Duplicate anchor #repeat'),
      expect.stringContaining('image without alternative text'),
      expect.stringContaining('Heading order skips from H1 to H3'),
    ]))
  })
  it('keeps footer information columns without link warnings or skipped heading levels', () => {
    const copy = structuredClone(config)
    const footer: BlockConfig = { id: 'footer', type: 'footer', variant: 'multi-column', props: {
      links: [], navItems: [{ label: 'News', url: '/news' }],
      columns: [{ title: 'Visit', links: ['219 Cardinal Street', 'Sandersville, GA 31082'] }, { title: 'Contact', links: ['office@nowhere.com'] }],
    } }
    copy.pages![0].blocks.push(footer)
    copy.blocks = copy.pages![0].blocks
    const before = structuredClone(copy)
    expect(checkSite(copy, undefined, true).filter(issue => issue.pageId === 'home')).toEqual([])
    expect(copy).toEqual(before)
    const heading = '<h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-2 @md:mb-3">Visit</h2>'
    const preview = renderToStaticMarkup(createElement(FooterBlock, { block: footer }))
    const exported = exportSiteToHTML({ name: 'Visit', blocks: copy.blocks })
    expect(preview).toContain(heading)
    expect(exported).toContain(heading)
    expect(preview).not.toContain('<h4')
    expect(exported).not.toContain('<h4')
    expect(preview).toContain('office@nowhere.com')
    expect(exported).toContain('office@nowhere.com')
  })
  it.each(['hero-image', 'grid', 'side-by-side'])('accepts an explicit image-page heading without changing the visible %s image', variant => {
    const image: BlockConfig = { id: 'banner', type: 'image', variant, props: {
      src: 'assets/happenings.png', alt: 'Parish happenings', caption: '', images: [{ src: 'assets/happenings.png', alt: 'Parish happenings' }],
    } }
    const page: SiteConfig = { name: 'Happenings', pages: [{ id: 'happenings', name: 'Happenings', path: '/', blocks: [image] }], blocks: [image] }
    expect(checkSite(page, undefined, true).some(issue => issue.message.includes('No H1 heading'))).toBe(true)
    const before = exportSiteToHTML(page)
    const previewBefore = renderToStaticMarkup(createElement(ImageBlock, { block: image }))
    image.props.pageHeading = '   '
    expect(exportSiteToHTML(page)).toBe(before)
    image.props.pageHeading = ' Parish happenings '
    const after = exportSiteToHTML(page)
    const previewAfter = renderToStaticMarkup(createElement(ImageBlock, { block: image }))
    expect(checkSite(page, undefined, true).filter(issue => issue.message.includes('heading'))).toEqual([])
    expect(after).toContain('<h1 class="sr-only">Parish happenings</h1>')
    expect(previewAfter).toContain('<h1 class="sr-only">Parish happenings</h1>')
    expect(after.replace('<h1 class="sr-only">Parish happenings</h1>', '')).toBe(before)
    expect(previewAfter.replace('<h1 class="sr-only">Parish happenings</h1>', '')).toBe(previewBefore)
  })
  it('recognizes generated Search and Articles destinations when enabled', () => {
    const copy = structuredClone(config)
    copy.pages![1].webstudioArticle = { status: 'ready', author: '', summary: '', createdAt: '', modifiedAt: '' }
    copy.pages![0].blocks.push({ id: 'nav', type: 'navbar', variant: 'default', props: { links: [], navItems: [{ label: 'Search', url: '/search.html' }, { label: 'Articles', url: '/articles/index.html' }] } })
    copy.blocks = copy.pages![0].blocks
    const enabled = checkSite(copy, { siteSearch: 'on' })
    expect(enabled.filter(issue => issue.blockId === 'nav')).toEqual([])
    const disabled = checkSite(copy, { siteSearch: 'off' })
    expect(disabled.some(issue => issue.blockId === 'nav' && issue.message.includes('/search.html'))).toBe(true)
  })
  it('warns about online media during export review without flagging ordinary links', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push(
      { id: 'remote-image', type: 'image', variant: 'hero-image', props: { src: 'https://example.test/photo.jpg', alt: 'Photo' } },
      { id: 'gallery', type: 'gallery', variant: 'grid', props: { images: [{ src: '//example.test/image.png', alt: 'Image' }] } },
      { id: 'local-image', type: 'image', variant: 'hero-image', props: { src: 'assets/local.png', alt: 'Photo' } },
      { id: 'video', type: 'video', variant: 'youtube', props: { url: 'https://youtu.be/abcdefghijk' } },
    )
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy, { siteDescription: 'Community information' }).filter(issue => issue.message.includes('online media'))
    expect(issues.map(issue => issue.blockId)).toEqual(['remote-image', 'gallery', 'video'])
  })
  it('checks exported SEO titles and descriptions using page and site settings', () => {
    const copy = structuredClone(config)
    const issues = checkSite(copy, { seoTitle: 'Community', siteDescription: '' })
    expect(issues.filter(issue => issue.message.includes('same SEO title'))).toHaveLength(2)
    expect(issues.filter(issue => issue.message.includes('no meta description'))).toHaveLength(2)
    copy.pages![1].webstudioSeo = { title: 'News', description: 'Latest news' }
    const improved = checkSite(copy, { seoTitle: 'Community', siteDescription: 'Community information' })
    expect(improved.filter(issue => issue.message.includes('SEO title') || issue.message.includes('meta description'))).toEqual([])
    copy.pages![1].webstudioArticle = { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' }
    const draftExcluded = checkSite(copy, { seoTitle: 'Community', siteDescription: '' })
    expect(draftExcluded.filter(issue => issue.message.includes('no meta description'))).toHaveLength(1)
  })
  it('recognizes an HTTPS contact service and rejects an unsafe configured service', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'contact-service', type: 'contact', variant: 'form', props: { formEndpoint: 'https://forms.example.test/submit', consentNotice: 'I agree to the privacy notice.' } })
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy).some(issue => issue.blockId === 'contact-service')).toBe(false)
    copy.pages![0].blocks.at(-1)!.props.consentNotice = ''
    expect(checkSite(copy).some(issue => issue.blockId === 'contact-service' && issue.message.includes('privacy and consent'))).toBe(true)
    copy.pages![0].blocks.at(-1)!.props.formEndpoint = 'http://forms.example.test/submit'
    expect(checkSite(copy).some(issue => issue.blockId === 'contact-service' && issue.message.includes('disabled'))).toBe(true)
    copy.pages![0].blocks.at(-1)!.props.formEndpoint = 'https://user:password@forms.example.test/submit'
    expect(checkSite(copy).some(issue => issue.blockId === 'contact-service' && issue.message.includes('disabled'))).toBe(true)
  })
  it('checks missing footer navigation destinations', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'footer', type: 'footer', variant: 'simple', props: { navItems: [{ label: 'Missing', url: '/missing' }] } })
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy).some(issue => issue.blockId === 'footer' && issue.message.includes('does not match a site page'))).toBe(true)
  })
  it('recognizes common video links consistently in checks and export', () => {
    const cases = [
      ['youtube', 'https://m.youtube.com/watch?feature=share&v=abcdefghijk', 'https://www.youtube-nocookie.com/embed/abcdefghijk'],
      ['youtube', 'https://youtube.com/shorts/abcdefghijk?feature=share', 'https://www.youtube-nocookie.com/embed/abcdefghijk'],
      ['youtube', 'https://youtu.be/abcdefghijk?t=1', 'https://www.youtube-nocookie.com/embed/abcdefghijk'],
      ['vimeo', 'https://player.vimeo.com/video/12345', 'https://player.vimeo.com/video/12345'],
    ]
    for (const [variant, url, expected] of cases) {
      const copy = structuredClone(config)
      copy.pages![0].blocks.push({ id: 'video', type: 'video', variant, props: { url } })
      copy.blocks = copy.pages![0].blocks
      expect(checkSite(copy).some(issue => issue.blockId === 'video')).toBe(false)
      expect(exportSiteToHTML({ name: 'Video', blocks: [copy.blocks[1]] })).toContain(expected)
    }
    for (const url of ['https://notyoutube.com/watch?v=abcdefghijk', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://vimeo.com.evil.test/12345']) {
      const variant = url.includes('vimeo') ? 'vimeo' : 'youtube'
      const video: BlockConfig = { id: 'video', type: 'video', variant, props: { url } }
      const copy = structuredClone(config)
      copy.pages![0].blocks.push(video)
      copy.blocks = copy.pages![0].blocks
      expect(checkSite(copy).some(issue => issue.blockId === 'video')).toBe(true)
      expect(exportSiteToHTML({ name: 'Video', blocks: [video] })).not.toContain('<iframe')
    }
  })
  it('warns when a button uses an unsupported destination', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks[0].props.primaryCtaUrl = '//example.com/path'
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy).some(issue => issue.message.includes('unsupported link address'))).toBe(true)
  })
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

  it('checks local anchors without contacting external links', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks[0].props.primaryCtaUrl = 'https://example.test/'
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy)).toEqual([])
    copy.pages![0].blocks[0].props.primaryCtaUrl = '#section'
    expect(checkSite(copy)[0].message).toContain('anchor #section was not found on Home')
    copy.pages![0].blocks[0].props.primaryCtaUrl = '/news?from=home#headlines'
    expect(checkSite(copy)).toEqual([])
    copy.pages![0].blocks[0].props.section1Objects = [{ id: 'photo', type: 'image', url: '/news#missing' }]
    expect(checkSite(copy)[0].message).toContain('anchor #missing was not found on News')
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
    copy.pages![0].blocks.push({ id: 'nav', type: 'navbar', variant: 'default', props: { links: ['About'], navItems: [{ label: 'News', url: '/news' }], ctaText: 'Join' } })
    copy.pages![0].blocks.push({ id: 'footer', type: 'footer', variant: 'multi-column', props: { links: ['Privacy'], navItems: [{ label: 'News', url: '/news' }], columns: [{ title: 'Visit', links: ['219 Cardinal Street'] }] } })
    copy.blocks = copy.pages![0].blocks
    const before = structuredClone(copy)
    const issues = checkSite(copy)
    expect(issues.filter(issue => issue.blockId === 'nav')).toHaveLength(2)
    expect(issues.filter(issue => issue.blockId === 'footer')).toHaveLength(1)
    expect(copy).toEqual(before)
    copy.pages![0].blocks[1].props.ctaUrl = '/news'
    expect(checkSite(copy).filter(issue => issue.blockId === 'nav')).toHaveLength(1)
    copy.pages![0].blocks[1].props = { links: [], ctaText: '' }
    copy.pages![0].blocks[2].props.links = []
    expect(checkSite(copy)).toEqual([])
  })
})
