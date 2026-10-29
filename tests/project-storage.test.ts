import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProjectFile } from '../src/project/project-file'

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

  it('assigns a fresh portable identity to Duplicate and preserves extension fields', () => {
    const first = useProjectsStore.getState().addProject('Original', document)
    const second = useProjectsStore.getState().duplicateProject(first)
    const duplicate = useProjectsStore.getState().projects.find(project => project.id === second)!
    expect(duplicate.projectFile?.projectId).not.toBe(document.projectId)
    expect(duplicate.projectFile?.pluginState).toEqual({ preserved: true })
    expect(document.projectId).toBe('original-file-id')
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
