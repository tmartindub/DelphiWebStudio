import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SiteConfig } from '@/blocks/types'
import type { SiteProjectFile } from '@/project/project-file'
import { ProjectMediaLibrary } from '@/media/media-library'

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
  addProject: (name: string, projectFile?: SiteProjectFile) => string
  saveProjectFile: (id: string, projectFile: SiteProjectFile) => void
  mediaChanged: (id: string) => void
  duplicateProject: (id: string) => Promise<string | null>
  deleteProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  updateProjectConfig: (id: string, config: SiteConfig) => void
  updateProjectSettings: (id: string, settings: Partial<ProjectSettings>) => void
  setDeployInfo: (id: string, url: string, deploymentId: string) => void
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      addProject: (name, projectFile) => {
        const id = `proj-${crypto.randomUUID()}`
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
          config: structuredClone(projectFile.config),
          projectFile: structuredClone(projectFile),
          blockCount: projectFile.config.pages?.reduce((sum, page) => sum + page.blocks.length, 0) ?? projectFile.config.blocks.length,
          updatedAt: 'Just now',
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
        await new ProjectMediaLibrary().copyProject(id, newId)
        set((s) => ({ projects: [clone, ...s.projects] }))
        return newId
      },
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),
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
    { name: 'openpage-projects' }
  )
)
