import { beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { createProjectFile } from '../src/project/project-file'
import { ProjectMediaLibrary } from '../src/media/media-library'

const storedValues = new Map<string, string>()
vi.stubGlobal('window', { localStorage: {
  getItem: (key: string) => storedValues.get(key) ?? null,
  setItem: (key: string, value: string) => storedValues.set(key, value),
  removeItem: (key: string) => storedValues.delete(key),
} })
const { useProjectsStore } = await import('../src/store/projectsStore')
const document = {
  ...createProjectFile({ name: 'Imported site', blocks: [] }, 'original-file-id'),
  pluginState: { preserved: true },
}

beforeEach(() => {
  useProjectsStore.setState({ projects: [] })
  storedValues.clear()
})

describe('portable project storage', () => {
  it('keeps staged import media out of the project list until the draft is ready', async () => {
    const stagedId = `proj-${crypto.randomUUID()}`
    const library = new ProjectMediaLibrary()
    await library.import(stagedId, new File(['original'], 'note.txt'))
    expect(useProjectsStore.getState().projects.some(project => project.id === stagedId)).toBe(false)
    expect(JSON.parse(storedValues.get('openpage-projects') ?? '{"state":{"projects":[]}}').state.projects.some((project: { id: string }) => project.id === stagedId)).toBe(false)
    expect(useProjectsStore.getState().addProject('Imported', document, stagedId)).toBe(stagedId)
    expect(await (await library.list(stagedId))[0].content.text()).toBe('original')
    expect(() => useProjectsStore.getState().addProject('Collision', document, stagedId)).toThrow('already in use')
    expect(useProjectsStore.getState().projects.filter(project => project.id === stagedId)).toHaveLength(1)
  })
  it('restores a removed project without replacing a project with the same ID', async () => {
    const id = useProjectsStore.getState().addProject('Original', document)
    const library = new ProjectMediaLibrary()
    await library.import(id, new File(['original'], 'note.txt'))
    const original = structuredClone(useProjectsStore.getState().projects.find(project => project.id === id)!)
    useProjectsStore.getState().deleteProject(id)
    expect(useProjectsStore.getState().projects.find(project => project.id === id)).toBeUndefined()
    useProjectsStore.getState().restoreProject(original)
    expect(useProjectsStore.getState().projects.find(project => project.id === id)).toEqual(original)
    expect(await (await library.list(id))[0].content.text()).toBe('original')
    useProjectsStore.getState().renameProject(id, 'New name')
    useProjectsStore.getState().restoreProject(original)
    expect(useProjectsStore.getState().projects.filter(project => project.id === id)).toHaveLength(1)
    expect(useProjectsStore.getState().projects.find(project => project.id === id)?.name).toBe('New name')
  })
  it('does not overwrite an unreadable project list', async () => {
    useProjectsStore.getState().addProject('Existing', document)
    const before = storedValues.get('openpage-projects')
    const read = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('storage unavailable') })
    try {
      await useProjectsStore.persist.rehydrate()
      read.mockRestore()
      useProjectsStore.getState().addProject('New in memory', document)
      expect(storedValues.get('openpage-projects')).toBe(before)
    } finally {
      read.mockRestore()
      await useProjectsStore.persist.rehydrate()
    }
  })
  it('does not overwrite a malformed stored project list', async () => {
    storedValues.set('openpage-projects', '{damaged')
    try {
      await useProjectsStore.persist.rehydrate()
      useProjectsStore.getState().addProject('New in memory', document)
      expect(storedValues.get('openpage-projects')).toBe('{damaged')
    } finally {
      storedValues.delete('openpage-projects')
      await useProjectsStore.persist.rehydrate()
    }
  })
  it.each([
    '{"state":{"projects":"invalid"},"version":0}',
    '{"state":{"projects":[]},"version":99}',
    '{"state":{"projects":[null]},"version":0}',
    '{"state":{"projects":[{"id":"one"}]},"version":0}',
    '{"state":{"projects":[{"id":"same","name":"One"},{"id":"same","name":"Two"}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","config":"damaged"}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","config":{"name":"One","blocks":[null]}}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","config":{"name":"One","blocks":[{"id":"orphan","type":"future","variant":"x","props":{}}],"pages":[{"id":"home","name":"Home","path":"/","blocks":[]}]}}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","config":{"name":"One","blocks":[{"id":"one","type":"hero","variant":"centered","props":null}]}}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","projectFile":{"config":{"name":"One","pages":[{"id":"home","name":"Home","path":"/","blocks":[null]}]}}}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","config":{"name":"One","blocks":[] ,"pages":[null]}}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","settings":[]}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","projectFile":[]}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","projectFile":{"config":{"name":"One","blocks":"damaged"}}}]},"version":0}',
    '{"state":{"projects":[{"id":"one","name":"One","projectFile":{"settings":"damaged"}}]},"version":0}',
  ])('protects incompatible project storage %s', async (stored) => {
    storedValues.set('openpage-projects', stored)
    try {
      await useProjectsStore.persist.rehydrate()
      useProjectsStore.getState().addProject('New in memory', document)
      expect(storedValues.get('openpage-projects')).toBe(stored)
    } finally {
      storedValues.delete('openpage-projects')
      await useProjectsStore.persist.rehydrate()
    }
  })
  it('loads an older valid project and keeps unknown configuration fields', async () => {
    const stored = '{"state":{"projects":[{"id":"one","name":"One","config":{"name":"One","blocks":[],"pluginData":{"value":"keep"}}}]},"version":0}'
    storedValues.set('openpage-projects', stored)
    try {
      await useProjectsStore.persist.rehydrate()
      expect(useProjectsStore.getState().projects[0].config).toMatchObject({ pluginData: { value: 'keep' } })
      useProjectsStore.getState().addProject('Another')
      expect(JSON.parse(storedValues.get('openpage-projects')!).state.projects.find((item: { id: string }) => item.id === 'one').config.pluginData.value).toBe('keep')
    } finally {
      storedValues.delete('openpage-projects')
      await useProjectsStore.persist.rehydrate()
    }
  })
  it('keeps a valid pages-only stored project file available', async () => {
    const stored = JSON.stringify({ state: { projects: [{ id: 'one', name: 'One', projectFile: {
      format: 'webstudio', schemaVersion: 2, projectId: 'file-one',
      config: { name: 'One', pages: [{ id: 'home', name: 'Home', path: '/', blocks: [] }] },
    } }] }, version: 0 })
    storedValues.set('openpage-projects', stored)
    try {
      await useProjectsStore.persist.rehydrate()
      expect(useProjectsStore.getState().projects[0].projectFile?.config.pages?.[0].name).toBe('Home')
      useProjectsStore.getState().addProject('Another')
      expect(JSON.parse(storedValues.get('openpage-projects')!).state.projects.find((item: { id: string }) => item.id === 'one').projectFile.config.pages[0].name).toBe('Home')
    } finally {
      storedValues.delete('openpage-projects')
      await useProjectsStore.persist.rehydrate()
    }
  })
  it('accepts legacy blocks matching a non-Home page', async () => {
    const block = { id: 'news-block', type: 'futureBlock', variant: 'custom', props: { value: 'keep' } }
    const stored = JSON.stringify({ state: { projects: [{ id: 'one', name: 'One', config: { name: 'One', blocks: [block], pages: [
      { id: 'home', name: 'Home', path: '/', blocks: [] },
      { id: 'news', name: 'News', path: '/news', blocks: [block] },
    ] } }] }, version: 0 })
    storedValues.set('openpage-projects', stored)
    try {
      await useProjectsStore.persist.rehydrate()
      expect(useProjectsStore.getState().projects[0].config?.pages?.[1].blocks[0]).toMatchObject(block)
      useProjectsStore.getState().addProject('Another')
      expect(JSON.parse(storedValues.get('openpage-projects')!).state.projects.some((item: { id: string }) => item.id === 'one')).toBe(true)
    } finally {
      storedValues.delete('openpage-projects')
      await useProjectsStore.persist.rehydrate()
    }
  })
  it('retains the in-memory project when local draft storage fails', () => {
    const write = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('storage full') })
    try {
      const id = useProjectsStore.getState().addProject('Original', document)
      expect(useProjectsStore.getState().projects.find(project => project.id === id)?.config?.name).toBe('Imported site')
    } finally { write.mockRestore() }
  })
  it('opens repeated imports as independent local drafts without overwriting the original identity', () => {
    const first = useProjectsStore.getState().addProject('First', document)
    const second = useProjectsStore.getState().addProject('Second', document)
    const projects = useProjectsStore.getState().projects
    expect(first).not.toBe(second)
    expect(projects).toHaveLength(2)
    expect(projects.every(project => project.status === 'draft')).toBe(true)
    expect(projects.map(project => project.projectFile?.projectId)).toEqual(['original-file-id', 'original-file-id'])
    expect(projects[0].projectFile).not.toBe(document)
  })

  it('assigns a fresh portable identity to Duplicate and preserves extension fields', async () => {
    const first = useProjectsStore.getState().addProject('Original', document)
    const second = await useProjectsStore.getState().duplicateProject(first)
    const duplicate = useProjectsStore.getState().projects.find(project => project.id === second)!
    expect(duplicate.projectFile?.projectId).not.toBe(document.projectId)
    expect(duplicate.projectFile?.pluginState).toEqual({ preserved: true })
    expect(document.projectId).toBe('original-file-id')
  })

  it.each(['rename', 'delete', 'media change'])('does not expose a stale duplicate after a concurrent %s', async change => {
    const first = useProjectsStore.getState().addProject('Original', document)
    let finishCopy!: () => void
    const copy = vi.spyOn(ProjectMediaLibrary.prototype, 'copyProject').mockImplementation(() => new Promise(resolve => { finishCopy = resolve }))
    try {
      const pending = useProjectsStore.getState().duplicateProject(first)
      if (change === 'rename') useProjectsStore.getState().renameProject(first, 'Changed')
      if (change === 'delete') useProjectsStore.getState().deleteProject(first)
      if (change === 'media change') useProjectsStore.getState().mediaChanged(first)
      finishCopy()
      await expect(pending).rejects.toThrow('The project changed while it was being duplicated. Try again.')
      expect(useProjectsStore.getState().projects.some(project => project.name.endsWith(' (Copy)'))).toBe(false)
    } finally { copy.mockRestore() }
  })

  it('duplicates media with stable references and isolates subsequent changes', async () => {
    const first = useProjectsStore.getState().addProject('Original', document)
    const library = new ProjectMediaLibrary()
    const { asset } = await library.import(first, new File(['original'], 'note.txt'))
    const second = await useProjectsStore.getState().duplicateProject(first)
    expect(second).toBeTruthy()
    const copy = await library.list(second!)
    expect(copy).toHaveLength(1)
    expect(copy[0].id).toBe(asset.id)
    expect(copy[0].path).toBe(asset.path)
    expect(await copy[0].content.text()).toBe('original')
    await library.remove(second!, asset.id)
    expect(await library.list(first)).toHaveLength(1)
  })

  it('does not copy deployment credentials or publication history', async () => {
    const first = useProjectsStore.getState().addProject('Original', {
      ...document,
      settings: { deployAccessKey: 'secret', siteName: 'Example' },
    })
    useProjectsStore.getState().updateProjectSettings(first, { deployAccessKey: 'secret', siteName: 'Example' })
    useProjectsStore.getState().setDeployInfo(first, 'https://example.test', 'deployment-id')
    const second = await useProjectsStore.getState().duplicateProject(first)
    const original = useProjectsStore.getState().projects.find(project => project.id === first)!
    const copy = useProjectsStore.getState().projects.find(project => project.id === second)!
    expect(copy.status).toBe('draft')
    expect(copy.deployUrl).toBeUndefined()
    expect(copy.deploymentId).toBeUndefined()
    expect(copy.lastDeployedAt).toBeUndefined()
    expect(copy.settings).toEqual({ siteName: 'Example' })
    expect(copy.projectFile?.settings).toEqual({ siteName: 'Example' })
    expect(original.settings?.deployAccessKey).toBe('secret')
    expect(original.status).toBe('published')
  })

  it('saves only the targeted local project and serializes its portable document to storage', () => {
    const first = useProjectsStore.getState().addProject('Original', document)
    const second = useProjectsStore.getState().addProject('Other', document)
    const updated = structuredClone(document)
    updated.config.name = 'Updated'
    useProjectsStore.getState().saveProjectFile(first, updated)
    const projects = useProjectsStore.getState().projects
    expect(projects.find(project => project.id === first)?.projectFile?.config.name).toBe('Updated')
    expect(projects.find(project => project.id === first)?.config?.name).toBe('Imported site')
    expect(projects.find(project => project.id === second)?.config?.name).toBe('Imported site')
    expect(document.config.name).toBe('Imported site')
    expect(JSON.parse(storedValues.get('openpage-projects')!).state.projects).toHaveLength(2)
  })

  it('does not replace newer draft changes when an older save finishes', () => {
    const id = useProjectsStore.getState().addProject('Original', document)
    const olderSnapshot = structuredClone(document)
    const blocks = [{ id: 'new', type: 'content' as const, variant: 'prose', props: { body: 'New work' } }]
    const newerDraft = { ...document.config, name: 'Edited while saving', blocks, pages: [{ id: 'home', name: 'Home', path: '/', blocks }] }
    useProjectsStore.getState().updateProjectConfig(id, newerDraft)
    useProjectsStore.getState().saveProjectFile(id, olderSnapshot)
    const project = useProjectsStore.getState().projects.find(item => item.id === id)!
    expect(project.config).toEqual(newerDraft)
    expect(project.blockCount).toBe(1)
    expect(project.projectFile?.config.name).toBe('Imported site')
  })
})
