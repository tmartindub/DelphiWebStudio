import { describe, expect, it, vi } from 'vitest'
import type { SiteConfig } from '../src/blocks/types'
import { acceptSiteActions, previewFivePagePlan, previewSinglePagePlan, previewSiteActions } from '../src/ai/site-actions'
import { createProjectFile, parseProjectFile, serializeProjectFile } from '../src/project/project-file'
import { exportSiteZip } from '../src/lib/export-html'
import JSZip from 'jszip'
import localPlan from './fixtures/local-ai-community-plan.json'

const storage = new Map<string, string>()
vi.stubGlobal('window', { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} })
const { useConfigStore } = await import('../src/store/configStore')

const config: SiteConfig = { name: 'Example', pages: [{ id: 'home', name: 'Home', path: '/', blocks: [{ id: 'original', type: 'content', variant: 'prose', props: { body: 'Original', extension: { keep: true } } }] }], blocks: [{ id: 'original', type: 'content', variant: 'prose', props: { body: 'Original', extension: { keep: true } } }] }
const proposal = (operations: unknown[]) => ({ schemaVersion: 1, requestId: 'request-1', mode: 'preview', operations })

describe('site action previews', () => {
  it('reviews and adds one page without changing existing content and supports undo', () => {
    const before = structuredClone(config)
    const preview = previewSinglePagePlan(config, { name: 'Contact', headline: 'Get in touch' }, 'page-1')
    expect(config).toEqual(before)
    expect(preview.proposedConfig.pages?.at(-1)).toMatchObject({ name: 'Contact', path: '/contact', blocks: [{ type: 'hero', props: { headline: 'Get in touch' } }] })
    useConfigStore.getState().setConfig(config)
    useConfigStore.getState().replaceConfig(acceptSiteActions(useConfigStore.getState().config, preview), 'Add reviewed page')
    expect(useConfigStore.getState().config.pages).toHaveLength(2)
    expect(() => previewSinglePagePlan(useConfigStore.getState().config, { name: 'Contact', headline: 'Again' }, 'page-2')).toThrow('already in use')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.pages).toHaveLength(1)
    expect(useConfigStore.getState().config.pages?.[0].blocks[0].props.body).toBe('Original')
  })
  it('accepts a previously generated local-model plan, saves it and exports five editable pages', async () => {
    const blank: SiteConfig = { name: 'Community', pages: [{ id: 'home', name: 'Home', path: '/', blocks: [] }], blocks: [] }
    const reviewed = acceptSiteActions(blank, previewFivePagePlan(blank, localPlan, 'local-plan'))
    const reopened = parseProjectFile(serializeProjectFile(createProjectFile(reviewed, 'sample'))).project.config
    expect(reopened.pages?.map(page => page.blocks[0].props.headline)).toEqual(localPlan.pages.map(page => page.headline))
    const zip = await JSZip.loadAsync(await (await exportSiteZip(reopened)).arrayBuffer())
    for (const [index, path] of ['index.html', 'about.html', 'events.html', 'resources.html', 'contact.html'].entries()) {
      expect(await zip.file(path)!.async('string')).toContain(localPlan.pages[index].headline.replace(/'/g, '&#39;'))
    }
  })
  it('turns a five-page model-shaped plan into an editable reviewed transaction', () => {
    const blank: SiteConfig = { name: 'New', pages: [{ id: 'home', name: 'Home', path: '/', blocks: [] }], blocks: [] }
    const plan = { pages: ['Welcome', 'About Us', 'Events', 'Resources', 'Contact'].map(name => ({ name, headline: `Welcome to ${name}` })) }
    const before = structuredClone(blank)
    const preview = previewFivePagePlan(blank, plan, 'plan-1')
    expect(blank).toEqual(before)
    expect(preview.proposedConfig.pages!.map(page => page.path)).toEqual(['/', '/about-us', '/events', '/resources', '/contact'])
    expect(preview.proposedConfig.pages!.every(page => page.blocks[0].props.headline)).toBe(true)
    useConfigStore.getState().setConfig(blank)
    useConfigStore.getState().replaceConfig(acceptSiteActions(useConfigStore.getState().config, preview), 'Apply reviewed plan')
    expect(useConfigStore.getState().config.pages).toHaveLength(5)
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.pages).toHaveLength(1)
  })

  it('rejects invalid plans and existing project content without changing it', () => {
    const blank: SiteConfig = { name: 'New', pages: [{ id: 'home', name: 'Home', path: '/', blocks: [] }], blocks: [] }
    const pages = ['Home', 'About', 'Events', 'Resources', 'Contact'].map(name => ({ name, headline: name }))
    expect(() => previewFivePagePlan(config, { pages }, 'plan-1')).toThrow('blank project')
    expect(() => previewFivePagePlan(blank, { pages: pages.slice(0, 4) }, 'plan-1')).toThrow('exactly five')
    expect(() => previewFivePagePlan(blank, { pages: [pages[0], pages[1], pages[1], pages[3], pages[4]] }, 'plan-1')).toThrow('distinct')
    expect(() => previewFivePagePlan(blank, { pages, command: 'run' }, 'plan-1')).toThrow('Invalid')
    expect(blank.pages![0].blocks).toEqual([])
  })
  it('previews a multi-page transaction without changing the source and preserves extensions', () => {
    const before = structuredClone(config)
    const preview = previewSiteActions(config, proposal([
      { op: 'createPage', pageId: 'news', name: 'News', path: '/news' },
      { op: 'addBlock', pageId: 'news', block: { id: 'headline', type: 'hero', variant: 'centered', props: { headline: 'Hello' } } },
      { op: 'modifyBlockProps', pageId: 'home', blockId: 'original', props: { body: 'Updated' } },
      { op: 'setThemeTokens', tokens: { accent: '#123456' } },
    ]))
    expect(config).toEqual(before)
    expect(preview.changes).toHaveLength(4)
    expect(preview.proposedConfig.pages).toHaveLength(2)
    expect(preview.proposedConfig.blocks[0].props).toEqual({ body: 'Updated', extension: { keep: true } })
    expect(preview.proposedConfig.theme?.accent).toBe('#123456')
  })

  it('rejects unsafe or unrecognized actions without changing the project', () => {
    const before = structuredClone(config)
    const bad = [
      [{ op: 'runShell', command: 'whoami' }],
      [{ op: 'createPage', pageId: 'new', name: 'Page', path: '/../outside' }],
      [{ op: 'addBlock', pageId: 'home', block: { id: 'x', type: 'hero', variant: 'centered', props: { headline: 'Hi', primaryCtaUrl: 'javascript:alert(1)' } } }],
      [{ op: 'modifyBlockProps', pageId: 'home', blockId: 'original', props: { html: '<script>bad()</script>' } }],
      [{ op: 'setThemeTokens', tokens: { accent: 'red' } }],
      [{ op: 'removeBlock', pageId: 'missing', blockId: 'original' }],
      [{ op: 'toString' }],
    ]
    for (const actions of bad) expect(() => previewSiteActions(config, proposal(actions))).toThrow()
    expect(() => previewSiteActions(config, proposal([{ op: 'createPage', pageId: 'new', name: 'New', path: '/new' }, { op: 'removeBlock', pageId: 'new', blockId: 'missing' }]))).toThrow('missing block')
    expect(config).toEqual(before)
  })

  it('rejects missing, duplicate, or unsupported block references', () => {
    expect(() => previewSiteActions(config, proposal([{ op: 'addBlock', pageId: 'home', block: { id: 'original', type: 'content', variant: 'prose', props: { body: 'Duplicate' } } }]))).toThrow('Duplicate block')
    expect(() => previewSiteActions(config, proposal([{ op: 'addBlock', pageId: 'home', block: { id: 'x', type: 'pdfViewer', variant: 'default', props: { assetId: 'unknown' } } }]))).toThrow('Unsupported block')
    expect(() => previewSiteActions(config, proposal([{ op: 'moveBlock', pageId: 'home', blockId: 'original', index: 2 }]))).toThrow('position')
  })

  it('rejects stale and modified previews before acceptance', () => {
    const preview = previewSiteActions(config, proposal([{ op: 'renamePage', pageId: 'home', name: 'Start' }]))
    const changed = structuredClone(config)
    changed.name = 'Changed'
    expect(() => acceptSiteActions(changed, preview)).toThrow('project changed')
    preview.proposedConfig.name = 'Tampered'
    expect(() => acceptSiteActions(config, preview)).toThrow('proposal changed')
  })

  it('can apply a reviewed snapshot as one undoable editor change', () => {
    useConfigStore.getState().setConfig(config)
    const preview = previewSiteActions(config, proposal([{ op: 'modifyBlockProps', pageId: 'home', blockId: 'original', props: { body: 'Approved' } }]))
    useConfigStore.getState().replaceConfig(acceptSiteActions(useConfigStore.getState().config, preview), 'Add planned pages')
    expect(useConfigStore.getState().config.blocks[0].props.body).toBe('Approved')
    expect(useConfigStore.getState().undoStack.at(-1)?.label).toBe('Add planned pages')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.blocks[0].props.body).toBe('Original')
  })
})
