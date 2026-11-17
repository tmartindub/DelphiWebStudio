import { afterEach, describe, expect, it, vi } from 'vitest'
import { acceptCreation, creationContext, generatePageBlueprint, previewCreation, validateBlueprint, type CreationOptions } from '../src/ai/gemini-pages'
import { requestGeminiCredential } from '../src/desktop/native-bridge'
import { useConfigStore } from '../src/store/configStore'
import { createProjectFile, parseProjectFile, serializeProjectFile } from '../src/project/project-file'
import { exportSiteToHTML } from '../src/lib/export-html'
import type { SiteConfig } from '../src/blocks/types'

vi.mock('../src/desktop/native-bridge', () => ({ requestGeminiCredential: vi.fn() }))
const options: CreationOptions = { mode: 'page', referencePageId: 'home', targetPageId: 'home', afterBlockId: null, includeNavigation: true }
const config: SiteConfig = { name: 'Example site', theme: { bg0: '#fffaf0', bg1: '#f1f5f9', text0: '#172033', accent: '#245a78', fontSans: 'Arial' }, blocks: [
  { id: 'nav', type: 'navbar', variant: 'default', props: { navItems: [{ label: 'Home', url: '/' }] } },
  { id: 'body', type: 'content', variant: 'prose', props: { body: 'Welcome to our community.', blockBackgroundColor: '#fffaf0', rawHtml: 'PRIVATE HTML MUST NOT BE SHARED', endpointSecret: 'PRIVATE KEY MUST NOT BE SHARED' } },
  { id: 'foot', type: 'footer', variant: 'minimal', props: { copyright: 'Existing copyright' } },
], pages: undefined }
config.pages = [{ id: 'home', name: 'Home', path: '/', blocks: structuredClone(config.blocks) }, { id: 'private', name: 'Private notes', path: '/private', blocks: [{ id: 'private-body', type: 'content', variant: 'prose', props: { body: 'PRIVATE PAGE CONTENT' } }] }]
const item = { title: 'Visitors', subtitle: '', body: 'A welcoming introduction.', button: 'Visit Home', url: '/', image: true }
const plan = { name: 'Community', path: '/community', sections: [{ kind: 'cards', title: 'Stay connected', body: 'Find out more.', columns: 3, tone: 'base', items: [item, { ...item, title: 'Events' }, { ...item, title: 'Volunteering' }] }] }
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })

describe('Gemini page and section creation', () => {
  it('shares only the reference text, style and page names, never other content or arbitrary properties', () => {
    const context = JSON.stringify(creationContext(config, options))
    expect(context).toContain('Welcome to our community.')
    expect(context).toContain('/private')
    expect(context).not.toContain('PRIVATE')
    expect(context).not.toContain('Existing copyright')
  })
  it('previews a new page with ordinary editable panels, text, photo placeholders and buttons without changing the source', () => {
    const before = JSON.stringify(config), proposal = previewCreation(config, plan, options)
    expect(JSON.stringify(config)).toBe(before)
    expect(proposal.config.pages).toHaveLength(3)
    expect(proposal.config.pages!.slice(0, 2)).toEqual(config.pages)
    const page = proposal.config.pages![2]
    expect(page.blocks.map(block => block.type)).toEqual(['navbar', 'content', 'footer'])
    expect(page.blocks[0].id).not.toBe('nav')
    expect(page.blocks[0].props).toEqual(config.blocks[0].props)
    const objects = page.blocks[1].props.section1Objects as { type: string; id: string; parentId?: string; url?: string }[]
    expect(objects.filter(object => object.type === 'panel')).toHaveLength(3)
    expect(objects.filter(object => object.type === 'image')).toHaveLength(3)
    expect(objects.filter(object => object.type === 'button').every(object => object.url === '/')).toBe(true)
    expect(objects.filter(object => object.type !== 'panel').every(object => objects.some(parent => parent.id === object.parentId && parent.type === 'panel'))).toBe(true)
    expect(page.blocks[1].props.blockBackgroundColor).toBe('#fffaf0')
  })
  it('inserts a section before the footer and retains every other page and block', () => {
    const proposal = previewCreation(config, plan, { ...options, mode: 'section' })
    expect(proposal.config.pages).toHaveLength(2)
    expect(proposal.config.pages![0].blocks.map(block => block.id)).toEqual(['nav', 'body', proposal.blocks[0].id, 'foot'])
    expect(proposal.config.pages![1]).toEqual(config.pages![1])
    expect(proposal.config.theme).toEqual(config.theme)
  })
  it('uses the selected insertion position, including immediately before a selected footer', () => {
    expect(previewCreation(config, plan, { ...options, mode: 'section', afterBlockId: 'nav' }).config.pages![0].blocks[1].id).not.toBe('body')
    expect(previewCreation(config, plan, { ...options, mode: 'section', afterBlockId: 'foot' }).config.pages![0].blocks.at(-1)!.id).toBe('foot')
  })
  it('can revise the proposed name and path locally and rejects collisions', () => {
    expect(() => previewCreation(config, plan, options, { name: 'Changed', path: '/private' })).toThrow('unique page address')
    const proposal = previewCreation(config, plan, options, { name: 'Changed', path: '/changed' })
    expect(proposal.config.pages!.at(-1)!.name).toBe('Changed')
    expect(proposal.config.pages!.at(-1)!.path).toBe('/changed')
  })
  it('rejects executable fields, external links, unsupported blocks and excessive proposals', () => {
    expect(() => previewCreation(config, { ...plan, script: 'alert(1)' }, options)).toThrow('unsupported layout field')
    expect(() => previewCreation(config, { ...plan, sections: [{ ...plan.sections[0], kind: 'customHTML' }] }, options)).toThrow('Unsupported section')
    expect(() => previewCreation(config, { ...plan, sections: [{ ...plan.sections[0], items: [{ ...item, url: 'https://outside.example' }] }] }, options)).toThrow('outside this site')
    expect(() => validateBlueprint({ ...plan, sections: Array(9).fill(plan.sections[0]) }, options, ['/'])).toThrow('up to eight')
    expect(() => previewCreation(config, { ...plan, sections: [plan.sections[0], plan.sections[0]] }, { ...options, mode: 'section' })).toThrow('one section')
  })
  it('rejects stale and tampered previews instead of overwriting changes', () => {
    const proposal = previewCreation(config, plan, options)
    expect(() => acceptCreation({ ...config, name: 'An intervening edit' }, proposal)).toThrow('project changed')
    proposal.config.name = 'tampered'
    expect(() => acceptCreation(config, proposal)).toThrow('preview changed')
  })
  it('supports exact undo/redo and portable save/reopen of the addition', () => {
    useConfigStore.getState().setConfig(config)
    const original = structuredClone(useConfigStore.getState().config)
    const proposal = previewCreation(original, plan, options)
    useConfigStore.getState().replaceConfig(acceptCreation(original, proposal), 'Gemini: add page')
    useConfigStore.getState().setActivePage(proposal.pageId)
    const added = structuredClone(useConfigStore.getState().config)
    const reopened = parseProjectFile(serializeProjectFile(createProjectFile(added, 'ai-page-test'))).project.config
    expect(reopened).toEqual(added)
    useConfigStore.getState().undo(); expect(useConfigStore.getState().config).toEqual(original); expect(useConfigStore.getState().activePageId).toBe('home')
    useConfigStore.getState().redo(); expect(useConfigStore.getState().config).toEqual(added)
    const html = exportSiteToHTML({ ...reopened, blocks: reopened.pages!.at(-1)!.blocks })
    expect(html).toContain('Stay connected'); expect(html).toContain('Volunteering'); expect(html).toContain('data-section-object')
  })
  it('creates normal team, FAQ, contact, calendar, gallery, hero and prose components', () => {
    const kinds = ['team', 'faq', 'contact', 'calendar', 'gallery', 'hero', 'text']
    for (const kind of kinds) {
      const input = { ...plan, sections: [{ ...plan.sections[0], kind, items: ['team', 'faq', 'gallery'].includes(kind) ? [item] : [] }] }
      const proposal = previewCreation(config, input, options)
      expect(proposal.blocks[0].type).toBe(kind === 'text' ? 'content' : kind)
      expect(proposal.blocks.every(block => !block.props.formEndpoint && !block.props.recipientEmail)).toBe(true)
    }
  })
  it('requires consent before reading a key or contacting Google', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(generatePageBlueprint(config, options, 'Create a page', '', { consent: false, freeTierConfirmed: true })).rejects.toThrow('Confirm')
    expect(requestGeminiCredential).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('can populate new gallery and staff sections from explicitly approved existing images', () => {
    const media = [{ id: 'church', name: 'Church.jpg', path: 'assets/church.jpg', mime: 'image/jpeg' }]
    for (const kind of ['gallery', 'team', 'cards']) {
      const input = { ...plan, sections: [{ ...plan.sections[0], kind, items: [{ ...item, assetId: 'church', image: true }] }] }
      const preview = previewCreation(config, input, { ...options, media })
      expect(JSON.stringify(preview.blocks)).toContain('assets/church.jpg')
      expect(() => previewCreation(config, input, options)).toThrow('approved media')
    }
  })
  it('uses the saved key in a header, with no tools, server fallback or retry', async () => {
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-key')
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] }))); vi.stubGlobal('fetch', fetch)
    const result = await generatePageBlueprint(config, options, 'Create a community page', 'Use only supplied facts.', { consent: true, freeTierConfirmed: true })
    expect(result.name).toBe('Community'); expect(fetch).toHaveBeenCalledTimes(1)
    const [url, request] = fetch.mock.calls[0]
    expect(url).toContain('gemini-3.5-flash-lite:generateContent'); expect(url).not.toContain('synthetic-key')
    expect(request.headers['x-goog-api-key']).toBe('synthetic-key')
    const body = JSON.parse(request.body); expect(body.tools).toBeUndefined(); expect(request.body).not.toContain('PRIVATE')
    expect(body.generationConfig.responseSchema.properties.sections.maxItems).toBeUndefined()
    expect(body.generationConfig.responseSchema.properties.sections.items.properties.items.maxItems).toBeUndefined()
  })
  it('reports quota failure without trying a paid service or another request', async () => {
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-key')
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 429 })); vi.stubGlobal('fetch', fetch)
    await expect(generatePageBlueprint(config, options, 'Create a page', '', { consent: true, freeTierConfirmed: true })).rejects.toThrow('free quota')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
