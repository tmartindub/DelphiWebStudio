import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { toast } from 'sonner'
import type { SiteConfig } from '@/blocks/types'
import type { SiteProjectFile } from '@/project/project-file'
import { ProjectMediaLibrary } from '@/media/media-library'

export let projectDraftReadFailed = false

export interface Project {
  id: string
  name: string
  status: 'published' | 'draft'
  updatedAt: string
  blockCount: number
  config?: SiteConfig
  settings?: ProjectSettings
  deployUrl?: string
  deploymentId?: string
  lastDeployedAt?: string
  projectFile?: SiteProjectFile
  mediaRevision?: number
}

export interface ProjectSettings {
  siteName?: string
  siteDescription?: string
  faviconUrl?: string
  language?: string
  seoTitle?: string
  seoDescription?: string
  siteBaseUrl?: string
  siteSearch?: string
  ogImageUrl?: string
  customDomain?: string
  gaId?: string
  posthogKey?: string
  deployAccessKey?: string
}

interface ProjectsState {
  projects: Project[]
  addProject: (name: string, projectFile?: SiteProjectFile, stagedId?: string) => string
  saveProjectFile: (id: string, projectFile: SiteProjectFile) => void
  mediaChanged: (id: string) => void
  duplicateProject: (id: string) => Promise<string | null>
  deleteProject: (id: string) => void
  restoreProject: (project: Project) => void
  renameProject: (id: string, name: string) => void
  updateProjectConfig: (id: string, config: SiteConfig) => void
  updateProjectSettings: (id: string, settings: Partial<ProjectSettings>) => void
  setDeployInfo: (id: string, url: string, deploymentId: string) => void
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      addProject: (name, projectFile, stagedId) => {
        const id = stagedId ?? `proj-${crypto.randomUUID()}`
        if (!id || useProjectsStore.getState().projects.some(project => project.id === id)) throw new Error('Project identity is already in use.')
        set((state) => ({
          projects: [
            {
              id,
              name,
              status: 'draft' as const,
              updatedAt: 'Just now',
              blockCount: 0,
              ...(projectFile ? {
                config: structuredClone(projectFile.config),
                projectFile: structuredClone(projectFile),
                ...(projectFile.settings ? { settings: structuredClone(projectFile.settings) as ProjectSettings } : {}),
                blockCount: projectFile.config.pages?.reduce((sum, page) => sum + page.blocks.length, 0) ?? projectFile.config.blocks.length,
              } : {}),
            },
            ...state.projects,
          ],
        }))
        return id
      },
      saveProjectFile: (id, projectFile) => set(state => ({
        projects: state.projects.map(project => project.id === id ? {
          ...project,
          projectFile: structuredClone(projectFile),
        } : project),
      })),
      mediaChanged: (id) => set(state => ({
        projects: state.projects.map(project => project.id === id ? { ...project, mediaRevision: (project.mediaRevision ?? 0) + 1 } : project),
      })),
      duplicateProject: async (id) => {
        const state = useProjectsStore.getState()
        const original = state.projects.find((p) => p.id === id)
        if (!original) return null
        const newId = `proj-${crypto.randomUUID()}`
        const clone: Project = {
          ...JSON.parse(JSON.stringify(original)),
          id: newId,
          name: `${original.name} (Copy)`,
          status: 'draft' as const,
          updatedAt: 'Just now',
          ...(original.projectFile ? {
            projectFile: { ...structuredClone(original.projectFile), projectId: crypto.randomUUID() },
          } : {}),
        }
        delete clone.deployUrl
        delete clone.deploymentId
        delete clone.lastDeployedAt
        if (clone.settings) delete clone.settings.deployAccessKey
        if (clone.projectFile?.settings) delete clone.projectFile.settings.deployAccessKey
        await new ProjectMediaLibrary().copyProject(id, newId)
        if (useProjectsStore.getState().projects.find(project => project.id === id) !== original) {
          throw new Error('The project changed while it was being duplicated. Try again.')
        }
        set((s) => ({ projects: [clone, ...s.projects] }))
        return newId
      },
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),
      restoreProject: (project) => set(state => state.projects.some(item => item.id === project.id)
        ? state : { projects: [structuredClone(project), ...state.projects] }),
      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name } : p
          ),
        })),
      updateProjectConfig: (id, config) => {
        const totalBlocks = config.pages
          ? config.pages.reduce((sum, page) => sum + page.blocks.length, 0)
          : config.blocks.length
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, config, blockCount: totalBlocks, updatedAt: 'Just now' } : p
          ),
        }))
      },
      updateProjectSettings: (id, settings) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, settings: { ...p.settings, ...settings } } : p
          ),
        })),
      setDeployInfo: (id, url, deploymentId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? { ...p, deployUrl: url, deploymentId, lastDeployedAt: new Date().toISOString(), status: 'published' as const }
              : p
          ),
        })),
    }),
    {
      name: 'openpage-projects',
      storage: createJSONStorage(() => {
        return {
          getItem: key => {
            try {
              const value = window.localStorage.getItem(key)
              if (value !== null) {
                const stored: unknown = JSON.parse(value)
                if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('Invalid project storage.')
                const envelope = stored as Record<string, unknown>
                if (!envelope.state || typeof envelope.state !== 'object' || Array.isArray(envelope.state) || !Array.isArray((envelope.state as Record<string, unknown>).projects)) throw new Error('Invalid project list.')
                if (envelope.version !== undefined && envelope.version !== 0) throw new Error('Unsupported project storage version.')
                const projects = (envelope.state as { projects: unknown[] }).projects
                const ids = new Set<string>()
                for (const project of projects) {
                  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('Invalid project entry.')
                  const entry = project as Record<string, unknown>
                  if (typeof entry.id !== 'string' || !entry.id || typeof entry.name !== 'string' || ids.has(entry.id)) throw new Error('Invalid project identity.')
                  ids.add(entry.id)
                  if (entry.settings !== undefined && (!entry.settings || typeof entry.settings !== 'object' || Array.isArray(entry.settings))) throw new Error('Invalid project settings.')
                  if (entry.projectFile !== undefined && (!entry.projectFile || typeof entry.projectFile !== 'object' || Array.isArray(entry.projectFile))) throw new Error('Invalid stored project file.')
                  const file = entry.projectFile as Record<string, unknown> | undefined
                  if (file?.settings !== undefined && (!file.settings || typeof file.settings !== 'object' || Array.isArray(file.settings))) throw new Error('Invalid stored project settings.')
                  for (const config of [entry.config, file?.config]) {
                    if (config === undefined) continue
                    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid project configuration.')
                    const draft = config as Record<string, unknown>
                    if (typeof draft.name !== 'string' || (draft.blocks !== undefined && !Array.isArray(draft.blocks)) ||
                      (draft.blocks === undefined && (!Array.isArray(draft.pages) || draft.pages.length === 0))) throw new Error('Invalid project configuration.')
                    if (draft.pages !== undefined && (!Array.isArray(draft.pages) || draft.pages.some(page =>
                      !page || typeof page !== 'object' || Array.isArray(page) || typeof page.id !== 'string' ||
                      typeof page.name !== 'string' || typeof page.path !== 'string' || !Array.isArray(page.blocks)
                    ))) throw new Error('Invalid project pages.')
                    for (const blocks of [draft.blocks, ...(Array.isArray(draft.pages) ? draft.pages.map(page => page.blocks) : [])]) {
                      if (blocks === undefined) continue
                      if (!Array.isArray(blocks) || blocks.some(block => !block || typeof block !== 'object' || Array.isArray(block) ||
                        typeof block.id !== 'string' || typeof block.type !== 'string' || typeof block.variant !== 'string' ||
                        !block.props || typeof block.props !== 'object' || Array.isArray(block.props))) throw new Error('Invalid project block.')
                    }
                    if (Array.isArray(draft.blocks) && Array.isArray(draft.pages) && draft.pages.length > 0 &&
                      !draft.pages.some(page => JSON.stringify(page.blocks) === JSON.stringify(draft.blocks))) throw new Error('Conflicting project blocks.')
                  }
                }
              }
              projectDraftReadFailed = false
              return value
            } catch {
              projectDraftReadFailed = true
              toast.error('Local drafts could not be read. Existing drafts are protected from overwrite; save any new work to a separate project file and restart to retry.', { id: 'draft-storage-read-failed', duration: Infinity, closeButton: true })
              return null
            }
          },
          setItem: (key, value) => {
            if (projectDraftReadFailed) return
            try { window.localStorage.setItem(key, value) } catch {
              toast.error('Local draft storage failed. Save a separate project file before closing; recent edits may not survive a restart.', { id: 'draft-storage-failed', duration: Infinity, closeButton: true })
            }
          },
          removeItem: key => { if (!projectDraftReadFailed) window.localStorage.removeItem(key) },
        }
      }),
    }
  )
)
