import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()
vi.stubGlobal('window', { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} })
const { useConfigStore } = await import('../src/store/configStore')

beforeEach(() => {
  useConfigStore.getState().setConfig({ name: 'Test', pages: [{ id: 'home', name: 'Home', path: '/', blocks: [] }], blocks: [] })
})

describe('page history', () => {
  it('duplicates a page with independent block IDs, a unique address and undo', () => {
    useConfigStore.getState().addBlock({ id: 'original', type: 'content', variant: 'prose', props: { body: 'Original text' } })
    useConfigStore.getState().duplicatePage('home')
    const copy = useConfigStore.getState().config.pages![1]
    expect(copy.path).toBe('/home-copy')
    expect(copy.blocks[0].id).not.toBe('original')
    useConfigStore.getState().updateBlockProps(copy.blocks[0].id, { body: 'Changed copy' })
    expect(useConfigStore.getState().config.pages![0].blocks[0].props.body).toBe('Original text')
    useConfigStore.getState().undo()
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.pages).toHaveLength(1)
    useConfigStore.getState().duplicatePage('home')
    useConfigStore.getState().duplicatePage('home')
    expect(useConfigStore.getState().config.pages!.map(page => page.path)).toContain('/home-copy-2')
  })
  it('shares a header across pages and keeps edits, new pages and undo consistent', () => {
    useConfigStore.getState().addBlock({ id: 'header', type: 'navbar', variant: 'default', props: { logoText: 'Welcome' } })
    useConfigStore.getState().addPage('About', '/about')
    useConfigStore.getState().setActivePage('home')
    useConfigStore.getState().shareSectionAcrossPages('header')
    let pages = useConfigStore.getState().config.pages!
    expect(pages[1].blocks[0].props.logoText).toBe('Welcome')
    useConfigStore.getState().updateBlockProps('header', { logoText: 'Updated' })
    pages = useConfigStore.getState().config.pages!
    expect(pages.map(page => page.blocks[0].props.logoText)).toEqual(['Updated', 'Updated'])
    useConfigStore.getState().addPage('News', '/news')
    expect(useConfigStore.getState().getActivePageBlocks()[0].props.logoText).toBe('Updated')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.pages).toHaveLength(2)
    useConfigStore.getState().setActivePage('home')
    useConfigStore.getState().unshareSection('header')
    useConfigStore.getState().updateBlockProps('header', { logoText: 'Independent' })
    expect(useConfigStore.getState().config.pages![1].blocks[0].props.logoText).toBe('Updated')
  })

  it('does not overwrite another page header when sharing', () => {
    useConfigStore.getState().addBlock({ id: 'first', type: 'navbar', variant: 'default', props: {} })
    useConfigStore.getState().addPage('About', '/about')
    useConfigStore.getState().addBlock({ id: 'second', type: 'navbar', variant: 'default', props: {} })
    expect(() => useConfigStore.getState().shareSectionAcrossPages('second')).toThrow('Remove other headers')
    expect(useConfigStore.getState().config.pages!.map(page => page.blocks[0].id)).toEqual(['first', 'second'])
  })
  it('saves a section for another page, inserts an independent copy and supports undo', () => {
    useConfigStore.getState().addBlock({ id: 'original', type: 'content', variant: 'prose', props: { body: 'Welcome' } })
    useConfigStore.getState().saveReusableSection('original', 'Welcome section')
    const section = useConfigStore.getState().config.webstudioReusableSections![0]
    useConfigStore.getState().addPage('About', '/about')
    useConfigStore.getState().insertReusableSection(section.id)
    const copy = useConfigStore.getState().getActivePageBlocks()[0]
    expect(copy.id).not.toBe('original')
    expect(copy.props.body).toBe('Welcome')
    useConfigStore.getState().updateBlockProps(copy.id, { body: 'Changed copy' })
    expect(useConfigStore.getState().config.webstudioReusableSections![0].block.props.body).toBe('Welcome')
    useConfigStore.getState().undo()
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().getActivePageBlocks()).toHaveLength(0)
  })
  it('ignores invalid block moves without changing content or undo history', () => {
    useConfigStore.getState().addBlock({ id: 'first', type: 'hero', variant: 'centered', props: { headline: 'First' } })
    useConfigStore.getState().addBlock({ id: 'second', type: 'hero', variant: 'centered', props: { headline: 'Second' } })
    const before = useConfigStore.getState()
    for (const [from, to] of [[-1, 0], [2, 0], [0, -1], [0, 2], [0.5, 1], [NaN, 1], [1, 1]]) {
      useConfigStore.getState().moveBlock(from, to)
      expect(useConfigStore.getState().config).toEqual(before.config)
      expect(useConfigStore.getState().undoStack).toEqual(before.undoStack)
    }
    useConfigStore.getState().moveBlock(0, 1)
    expect(useConfigStore.getState().getActivePageBlocks().map(block => block.id)).toEqual(['second', 'first'])
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().getActivePageBlocks().map(block => block.id)).toEqual(['first', 'second'])
  })
  it.each([
    '{"state":{"config":null},"version":2}',
    '{"state":{"config":{"name":"Future","blocks":[]}},"version":99}',
    '{"state":{"config":{"name":"Broken","blocks":null}},"version":2}',
    '{"state":{"config":{"name":"Broken","blocks":[],"pages":[null]}},"version":2}',
    '{"state":{"config":{"name":"Broken","blocks":[],"pages":[{"id":"home","name":"Home","path":"/","blocks":"bad"}]}},"version":2}',
    '{"state":{"config":{"name":"Broken","blocks":[null]}},"version":2}',
    '{"state":{"config":{"name":"Broken","blocks":[{"id":"orphan","type":"future","variant":"x","props":{}}],"pages":[{"id":"home","name":"Home","path":"/","blocks":[]}]}},"version":2}',
    '{"state":{"config":{"name":"Broken","blocks":[{"id":"one","type":"hero","variant":"centered","props":null}]}},"version":0}',
    '{"state":{"config":{"name":"Broken","blocks":[],"webstudioReusableSections":[null]}},"version":2}',
    '{"state":{"config":{"name":"Broken","pages":[{"id":"home","name":"Home","path":"/","blocks":[{"id":"one","type":"hero","variant":"centered","props":[]}]}]}},"version":2}',
  ])('protects incompatible editor storage %s', async (stored) => {
    storage.set('openpage-config', stored)
    try {
      await useConfigStore.persist.rehydrate()
      useConfigStore.getState().addPage('In memory', '/memory')
      expect(storage.get('openpage-config')).toBe(stored)
    } finally {
      storage.delete('openpage-config')
      await useConfigStore.persist.rehydrate()
    }
  })
  it('continues to migrate a legacy single-page draft', async () => {
    storage.set('openpage-config', '{"state":{"config":{"name":"Legacy","blocks":[]}},"version":0}')
    await useConfigStore.persist.rehydrate()
    expect(useConfigStore.getState().config.pages).toMatchObject([{ id: 'page-home', path: '/', blocks: [] }])
    expect(useConfigStore.getState().config.name).toBe('Legacy')
  })
  it('retains a valid pages-only draft and unknown block data', async () => {
    const stored = '{"state":{"config":{"name":"Older","pages":[{"id":"home","name":"Home","path":"/","blocks":[{"id":"one","type":"futureBlock","variant":"custom","props":{"unknown":"keep"}}]}]}},"version":2}'
    storage.set('openpage-config', stored)
    try {
      await useConfigStore.persist.rehydrate()
      expect(useConfigStore.getState().config.pages?.[0].blocks[0]).toMatchObject({ type: 'futureBlock', props: { unknown: 'keep' } })
    } finally {
      storage.delete('openpage-config')
      await useConfigStore.persist.rehydrate()
    }
  })
  it('retains legacy blocks matching a non-Home page', async () => {
    const block = { id: 'news-block', type: 'futureBlock', variant: 'custom', props: { value: 'keep' } }
    const stored = JSON.stringify({ state: { config: { name: 'Older', blocks: [block], pages: [
      { id: 'home', name: 'Home', path: '/', blocks: [] },
      { id: 'news', name: 'News', path: '/news', blocks: [block] },
    ] } }, version: 2 })
    storage.set('openpage-config', stored)
    try {
      await useConfigStore.persist.rehydrate()
      expect(useConfigStore.getState().config.pages?.[1].blocks[0]).toMatchObject(block)
      useConfigStore.getState().addPage('Another', '/another')
      expect(JSON.parse(storage.get('openpage-config')!).state.config.pages[1].blocks[0].props.value).toBe('keep')
    } finally {
      storage.delete('openpage-config')
      await useConfigStore.persist.rehydrate()
    }
  })
  it('keeps edits in memory when local draft storage fails', () => {
    const write = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('storage full') })
    try {
      expect(() => useConfigStore.getState().addPage('News', '/news')).not.toThrow()
      expect(useConfigStore.getState().config.pages?.[1].name).toBe('News')
    } finally { write.mockRestore() }
  })
  it('rejects invalid or missing page renames without changing history or content', () => {
    const id = useConfigStore.getState().addPage('News', '/news')
    const before = useConfigStore.getState()
    expect(() => before.renamePage(id, '   ')).toThrow('Page name is required')
    expect(() => before.renamePage('missing', 'Other')).toThrow('Page no longer exists')
    expect(useConfigStore.getState().config).toEqual(before.config)
    expect(useConfigStore.getState().undoStack).toEqual(before.undoStack)
    before.renamePage(id, 'News')
    expect(useConfigStore.getState().undoStack).toEqual(before.undoStack)
    before.renamePage(id, 'Updates')
    expect(useConfigStore.getState().config.pages![1].name).toBe('Updates')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.pages![1].name).toBe('News')
  })
  it('saves and undoes page search metadata without affecting another page', () => {
    const id = useConfigStore.getState().addPage('News', '/news')
    useConfigStore.getState().updatePageSeo(id, 'News title', 'News description')
    expect(useConfigStore.getState().config.pages![1].webstudioSeo).toEqual({ title: 'News title', description: 'News description' })
    expect(useConfigStore.getState().config.pages![0].webstudioSeo).toBeUndefined()
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.pages![1].webstudioSeo).toBeUndefined()
    useConfigStore.getState().redo()
    expect(useConfigStore.getState().config.pages![1].webstudioSeo?.title).toBe('News title')
  })
  it('restores the selected page when adding, undoing and redoing pages', () => {
    const id = useConfigStore.getState().addPage('News', '/news')
    expect(useConfigStore.getState().activePageId).toBe(id)
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().activePageId).toBe('home')
    expect(useConfigStore.getState().config.pages).toHaveLength(1)
    useConfigStore.getState().redo()
    expect(useConfigStore.getState().activePageId).toBe(id)
    expect(useConfigStore.getState().config.pages).toHaveLength(2)
  })

  it('preserves Home blocks when another page is edited and restores deleted pages', () => {
    useConfigStore.getState().addBlock({ id: 'h', type: 'hero', variant: 'centered', props: { headline: 'Home' } })
    const id = useConfigStore.getState().addPage('News', '/news')
    useConfigStore.getState().addBlock({ id: 'n', type: 'hero', variant: 'centered', props: { headline: 'News' } })
    expect(useConfigStore.getState().config.blocks[0].id).toBe('h')
    useConfigStore.getState().renamePage(id, 'Latest')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.pages?.[1].name).toBe('News')
    useConfigStore.getState().removePage(id)
    expect(useConfigStore.getState().activePageId).toBe('home')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().activePageId).toBe(id)
    expect(useConfigStore.getState().getActivePageBlocks()[0].id).toBe('n')
  })

  it('rejects invalid or duplicate paths and protects Home', () => {
    useConfigStore.getState().addPage('News', '/news')
    expect(() => useConfigStore.getState().addPage('Duplicate', '/NEWS')).toThrow('Duplicate page path')
    expect(() => useConfigStore.getState().addPage('Unsafe', '/../escape')).toThrow()
    useConfigStore.getState().removePage('home')
    expect(useConfigStore.getState().config.pages).toHaveLength(2)
  })

  it('changes a page address with undo and rejects unsafe, duplicate or Home addresses', () => {
    const id = useConfigStore.getState().addPage('News', '/news')
    useConfigStore.getState().addPage('Contact', '/contact')
    useConfigStore.getState().changePagePath(id, '/updates')
    expect(useConfigStore.getState().config.pages?.find(page => page.id === id)?.path).toBe('/updates')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.pages?.find(page => page.id === id)?.path).toBe('/news')
    useConfigStore.getState().redo()
    expect(useConfigStore.getState().config.pages?.find(page => page.id === id)?.path).toBe('/updates')
    for (const path of ['/CONTACT', '/../escape', '/']) expect(() => useConfigStore.getState().changePagePath(id, path)).toThrow()
    expect(() => useConfigStore.getState().changePagePath('home', '/other')).toThrow('Home')
    expect(useConfigStore.getState().config.pages?.find(page => page.id === id)?.path).toBe('/updates')
  })

  it('optionally updates known page links in one undoable change, preserving queries and anchors', () => {
    useConfigStore.getState().addBlock({ id: 'h', type: 'hero', variant: 'centered', props: { primaryCtaUrl: '/news?from=home#top', secondaryCtaUrl: 'https://example.com/news' } })
    useConfigStore.getState().addBlock({ id: 'text', type: 'content', variant: 'prose', props: { body: '[Latest](/news?x=1#top) [Other](https://example.com/news)' } })
    useConfigStore.getState().addBlock({ id: 'nav', type: 'navbar', variant: 'default', props: { navItems: [{ label: 'News', url: '/news#latest' }] } })
    useConfigStore.getState().addBlock({ id: 'footer', type: 'footer', variant: 'simple', props: { navItems: [{ label: 'News', url: '/news?footer=1#latest' }] } })
    const id = useConfigStore.getState().addPage('News', '/news')
    useConfigStore.getState().addBlock({ id: 'c', type: 'cta', variant: 'simple', props: { buttonUrl: '/news/' } })
    useConfigStore.getState().changePagePath(id, '/updates', true)
    let pages = useConfigStore.getState().config.pages!
    expect(pages[0].blocks[0].props.primaryCtaUrl).toBe('/updates?from=home#top')
    expect(pages[0].blocks[0].props.secondaryCtaUrl).toBe('https://example.com/news')
    expect(pages[0].blocks[1].props.body).toBe('[Latest](/updates?x=1#top) [Other](https://example.com/news)')
    expect(pages[0].blocks[2].props.navItems).toEqual([{ label: 'News', url: '/updates#latest' }])
    expect(pages[0].blocks[3].props.navItems).toEqual([{ label: 'News', url: '/updates?footer=1#latest' }])
    expect(pages[1].blocks[0].props.buttonUrl).toBe('/updates')
    expect(useConfigStore.getState().config.blocks[0].props.primaryCtaUrl).toBe('/updates?from=home#top')
    useConfigStore.getState().undo()
    pages = useConfigStore.getState().config.pages!
    expect(pages[1].path).toBe('/news')
    expect(pages[0].blocks[0].props.primaryCtaUrl).toBe('/news?from=home#top')
    expect(pages[0].blocks[1].props.body).toBe('[Latest](/news?x=1#top) [Other](https://example.com/news)')
    expect(pages[0].blocks[2].props.navItems).toEqual([{ label: 'News', url: '/news#latest' }])
    expect(pages[0].blocks[3].props.navItems).toEqual([{ label: 'News', url: '/news?footer=1#latest' }])
    useConfigStore.getState().redo()
    expect(useConfigStore.getState().config.pages![1].path).toBe('/updates')
    useConfigStore.getState().changePagePath(id, '/articles', false)
    expect(useConfigStore.getState().config.pages![0].blocks[0].props.primaryCtaUrl).toBe('/updates?from=home#top')
  })

  it('undoes and redoes a complete JSON replacement without discarding extension data', () => {
    const before = { ...useConfigStore.getState().config, name: 'Original', extension: { retained: 1 } }
    useConfigStore.getState().setConfig(before)
    useConfigStore.getState().replaceConfig({ ...before, name: 'Edited', extension: { retained: 2 } })
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config).toEqual(before)
    useConfigStore.getState().redo()
    expect(useConfigStore.getState().config.name).toBe('Edited')
    expect((useConfigStore.getState().config as typeof before).extension).toEqual({ retained: 2 })
  })
})
