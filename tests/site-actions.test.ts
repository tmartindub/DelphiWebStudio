import { describe, expect, it, vi } from 'vitest'
import type { SiteConfig } from '../src/blocks/types'
import { acceptSiteActions, previewSiteActions } from '../src/ai/site-actions'

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
    useConfigStore.getState().replaceConfig(acceptSiteActions(useConfigStore.getState().config, preview))
    expect(useConfigStore.getState().config.blocks[0].props.body).toBe('Approved')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.blocks[0].props.body).toBe('Original')
  })
})
