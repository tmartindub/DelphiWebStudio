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
    expect(projects.find(project => project.id === first)?.config?.name).toBe('Updated')
    expect(projects.find(project => project.id === second)?.config?.name).toBe('Imported site')
    expect(document.config.name).toBe('Imported site')
    expect(JSON.parse(storedValues.get('openpage-projects')!).state.projects).toHaveLength(2)
  })
})
