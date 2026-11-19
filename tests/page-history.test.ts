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
})
