import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { produce } from 'immer'
import { toast } from 'sonner'
import type { BlockConfig, SiteConfig, ThemeConfig, PageConfig } from '@/blocks/types'
import { validateProjectConfig } from '@/project/project-file'

export let configDraftReadFailed = false

function ensurePages(config: SiteConfig): PageConfig[] {
  if (config.pages && config.pages.length > 0) return config.pages
  return [{ id: 'page-home', name: 'Home', path: '/', blocks: config.blocks }]
}

function getPageBlocks(config: SiteConfig, pageId: string): BlockConfig[] {
  const pages = ensurePages(config)
  const page = pages.find((p) => p.id === pageId)
  return page?.blocks ?? pages[0]?.blocks ?? []
}

interface UndoEntry {
  config: SiteConfig
  label: string
  timestamp: number
  activePageId: string
}

interface ConfigState {
  config: SiteConfig
  activePageId: string
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  setConfig: (config: SiteConfig) => void
  replaceConfig: (config: SiteConfig, label?: string) => void
  setActivePage: (id: string) => void
  getActivePageBlocks: () => BlockConfig[]
  updateBlock: (id: string, updates: Partial<BlockConfig>) => void
  updateBlockProps: (id: string, props: Record<string, unknown>) => void
  addBlock: (block: BlockConfig, index?: number) => void
  removeBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  moveBlock: (fromIndex: number, toIndex: number) => void
  addPage: (name: string, path: string) => string
  removePage: (id: string) => void
  renamePage: (id: string, name: string) => void
  changePagePath: (id: string, path: string, updateLinks?: boolean) => void
  updatePageSeo: (id: string, title: string, description: string) => void
  setTheme: (theme: Partial<ThemeConfig>) => void
  updateTheme: (partial: Partial<ThemeConfig>) => void
  previewTheme: (partial: Partial<ThemeConfig>) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

const defaultBlocks: BlockConfig[] = []

export const defaultConfig: SiteConfig = {
  name: 'My Website',
  pages: [{ id: 'page-home', name: 'Home', path: '/', blocks: defaultBlocks }],
  blocks: defaultBlocks,
}

function snapshot(state: ConfigState): { config: SiteConfig; activePageId: string } {
  return {
    config: structuredClone(state.config),
    activePageId: state.activePageId,
  }
}

const MAX_UNDO = 50

function pushUndo(state: ConfigState, label: string): Partial<ConfigState> {
  const snap = snapshot(state)
  return {
    undoStack: [...state.undoStack, { ...snap, label, timestamp: Date.now() }].slice(-MAX_UNDO),
    redoStack: [],
  }
}

function withPages(config: SiteConfig): SiteConfig {
  const pages = ensurePages(config)
  return { ...config, pages }
}

function mutateActivePageBlocks(
  config: SiteConfig,
  activePageId: string,
  mutator: (blocks: BlockConfig[]) => BlockConfig[],
): SiteConfig {
  const pages = ensurePages(config)
  const newPages = pages.map((p) =>
    p.id === activePageId ? { ...p, blocks: mutator([...p.blocks]) } : p,
  )
  const homeBlocks = (newPages.find((page) => page.path === '/') ?? newPages[0])?.blocks ?? []
  return { ...config, pages: newPages, blocks: homeBlocks }
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      activePageId: 'page-home',
      undoStack: [],
      redoStack: [],

      setConfig: (config) => {
        const pages = ensurePages(config)
        set({ config: { ...config, pages }, activePageId: pages[0]?.id ?? 'page-home', undoStack: [], redoStack: [] })
      },
      replaceConfig: (config, label = 'Edit project JSON') => set(state => ({
        ...pushUndo(state, label),
        config,
        activePageId: config.pages?.some(page => page.id === state.activePageId) ? state.activePageId : config.pages?.[0]?.id ?? 'page-home',
      })),

      setActivePage: (id) => set((state) => ensurePages(state.config).some(page => page.id === id) ? { activePageId: id } : state),

      getActivePageBlocks: () => {
        const state = get()
        return getPageBlocks(state.config, state.activePageId)
      },

      updateBlock: (id, updates) =>
        set((state) => ({
          ...pushUndo(state, 'Update block'),
          config: produce(withPages(state.config), (draft) => {
            const page = draft.pages!.find((p) => p.id === state.activePageId)
            if (!page) return
            const block = page.blocks.find((b) => b.id === id)
            if (block) Object.assign(block, updates)
            draft.blocks = (draft.pages!.find(p => p.path === '/') ?? draft.pages![0]).blocks
          }),
        })),

      updateBlockProps: (id, props) =>
        set((state) => ({
          ...pushUndo(state, 'Update properties'),
          config: produce(withPages(state.config), (draft) => {
            const page = draft.pages!.find((p) => p.id === state.activePageId)
            if (!page) return
            const block = page.blocks.find((b) => b.id === id)
            if (block) Object.assign(block.props, props)
            draft.blocks = (draft.pages!.find(p => p.path === '/') ?? draft.pages![0]).blocks
          }),
        })),

      addBlock: (block, index) =>
        set((state) => ({
          ...pushUndo(state, 'Add block'),
          config: mutateActivePageBlocks(withPages(state.config), state.activePageId, (blocks) => {
            if (index !== undefined) {
              blocks.splice(index, 0, block)
            } else {
              blocks.push(block)
            }
            return blocks
          }),
        })),

      removeBlock: (id) =>
        set((state) => ({
          ...pushUndo(state, 'Remove block'),
          config: mutateActivePageBlocks(withPages(state.config), state.activePageId, (blocks) =>
            blocks.filter((b) => b.id !== id),
          ),
        })),

      duplicateBlock: (id) =>
        set((state) => {
          const blocks = getPageBlocks(state.config, state.activePageId)
          const idx = blocks.findIndex((b) => b.id === id)
          if (idx === -1) return state
          const original = blocks[idx]
          const clone: BlockConfig = {
            ...JSON.parse(JSON.stringify(original)),
            id: `block-${crypto.randomUUID()}`,
          }
          return {
            ...pushUndo(state, 'Duplicate block'),
            config: mutateActivePageBlocks(withPages(state.config), state.activePageId, (b) => {
              b.splice(idx + 1, 0, clone)
              return b
            }),
          }
        }),

      moveBlock: (fromIndex, toIndex) =>
        set((state) => {
          const blocks = getPageBlocks(state.config, state.activePageId)
          if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 ||
            fromIndex >= blocks.length || toIndex >= blocks.length || fromIndex === toIndex) return state
          return {
            ...pushUndo(state, 'Move block'),
            config: mutateActivePageBlocks(withPages(state.config), state.activePageId, (pageBlocks) => {
              const [moved] = pageBlocks.splice(fromIndex, 1)
              pageBlocks.splice(toIndex, 0, moved)
              return pageBlocks
            }),
          }
        }),

      addPage: (name, path) => {
        const id = `page-${crypto.randomUUID()}`
        set((state) => {
          const pages = [...ensurePages(state.config), { id, name, path, blocks: [] }]
          const config = validateProjectConfig({ ...state.config, pages })
          return { ...pushUndo(state, 'Add page'), config, activePageId: id }
        })
        return id
      },

      removePage: (id) =>
        set((state) => {
          const pages = ensurePages(state.config)
          if (pages.length <= 1 || pages.find(page => page.id === id)?.path === '/' || !pages.some(page => page.id === id)) return state
          const newPages = pages.filter((p) => p.id !== id)
          const newActiveId = state.activePageId === id ? newPages[0].id : state.activePageId
          return {
            ...pushUndo(state, 'Remove page'),
            config: { ...state.config, pages: newPages, blocks: (newPages.find(page => page.path === '/') ?? newPages[0]).blocks },
            activePageId: newActiveId,
          }
        }),

      renamePage: (id, name) => set((state) => {
        const page = ensurePages(state.config).find(item => item.id === id)
        if (!page) throw new Error('Page no longer exists.')
        if (page.name === name) return state
        if (!name.trim()) throw new Error('Page name is required.')
        const changed = produce(withPages(state.config), draft => {
          draft.pages!.find(item => item.id === id)!.name = name
        })
        return { ...pushUndo(state, 'Rename page'), config: changed }
      }),

      changePagePath: (id, path, updateLinks = false) => set(state => {
        const pages = ensurePages(state.config)
        const page = pages.find(item => item.id === id)
        if (!page || page.path === '/') throw new Error('The Home page address cannot be changed.')
        if (page.path === path) return state
        const changed = produce(withPages(state.config), draft => {
          draft.pages!.find(item => item.id === id)!.path = path
          if (updateLinks) for (const item of draft.pages!) for (const block of item.blocks) {
            if (block.type === 'content' && typeof block.props.body === 'string') {
              block.props.body = block.props.body.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, destination: string) => {
                const split = destination.search(/[?#]/)
                const originalPath = (split < 0 ? destination : destination.slice(0, split)).replace(/\/$/, '') || '/'
                return originalPath === page.path || originalPath === encodeURI(page.path) ? `[${label}](${path}${split < 0 ? '' : destination.slice(split)})` : match
              })
            }
            if ((block.type === 'navbar' || block.type === 'footer') && Array.isArray(block.props.navItems)) for (const navItem of block.props.navItems) {
              if (!navItem || typeof navItem.url !== 'string') continue
              const trimmed = navItem.url.trim()
              const split = trimmed.search(/[?#]/)
              const originalPath = (split < 0 ? trimmed : trimmed.slice(0, split)).replace(/\/$/, '') || '/'
              if (originalPath === page.path || originalPath === encodeURI(page.path)) navItem.url = path + (split < 0 ? '' : trimmed.slice(split))
            }
            const keys = block.type === 'hero' ? ['primaryCtaUrl', 'secondaryCtaUrl'] : block.type === 'cta' ? ['buttonUrl'] : block.type === 'banner' ? ['linkUrl'] : block.type === 'navbar' ? ['ctaUrl'] : []
            for (const key of keys) {
              const value = block.props[key]
              if (typeof value !== 'string') continue
              const trimmed = value.trim()
              const split = trimmed.search(/[?#]/)
              const originalPath = (split < 0 ? trimmed : trimmed.slice(0, split)).replace(/\/$/, '') || '/'
              if (originalPath === page.path || originalPath === encodeURI(page.path)) block.props[key] = path + (split < 0 ? '' : trimmed.slice(split))
            }
          }
          draft.blocks = draft.pages!.find(item => item.path === '/')!.blocks
        })
        const config = validateProjectConfig(changed)
        return { ...pushUndo(state, 'Change page address'), config }
      }),

      updatePageSeo: (id, title, description) => set(state => {
        if (!ensurePages(state.config).some(page => page.id === id)) throw new Error('Page no longer exists.')
        const changed = produce(withPages(state.config), draft => {
          const page = draft.pages!.find(item => item.id === id)!
          page.webstudioSeo = { ...page.webstudioSeo, title, description }
        })
        return { ...pushUndo(state, 'Change page search details'), config: validateProjectConfig(changed) }
      }),

      setTheme: (theme) =>
        set((state) => ({
          ...pushUndo(state, 'Change theme'),
          config: { ...state.config, theme },
        })),

      updateTheme: (partial) =>
        set((state) => ({
          ...pushUndo(state, 'Update theme'),
          config: { ...state.config, theme: { ...state.config.theme, ...partial } },
        })),

      previewTheme: (partial) =>
        set((state) => ({
          config: { ...state.config, theme: { ...state.config.theme, ...partial } },
        })),

      undo: () =>
        set((state) => {
          if (state.undoStack.length === 0) return state
          const prev = state.undoStack[state.undoStack.length - 1]
          const snap = snapshot(state)
          return {
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, { ...snap, label: prev.label, timestamp: Date.now() }],
            config: prev.config,
            activePageId: prev.activePageId,
          }
        }),

      redo: () =>
        set((state) => {
          if (state.redoStack.length === 0) return state
          const next = state.redoStack[state.redoStack.length - 1]
          const snap = snapshot(state)
          return {
            redoStack: state.redoStack.slice(0, -1),
            undoStack: [...state.undoStack, { ...snap, label: next.label, timestamp: Date.now() }],
            config: next.config,
            activePageId: next.activePageId,
          }
        }),

      canUndo: () => get().undoStack.length > 0,
      canRedo: () => get().redoStack.length > 0,
    }),
    {
      name: 'openpage-config',
      storage: createJSONStorage(() => {
        return {
          getItem: key => {
            try {
              const value = window.localStorage.getItem(key)
              if (value !== null) {
                const stored: unknown = JSON.parse(value)
                if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('Invalid draft storage.')
                const envelope = stored as Record<string, unknown>
                if (!envelope.state || typeof envelope.state !== 'object' || Array.isArray(envelope.state)) throw new Error('Invalid draft state.')
                const config = (envelope.state as Record<string, unknown>).config
                if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid draft config.')
                if (envelope.version !== undefined && (!Number.isInteger(envelope.version) || (envelope.version as number) < 0 || (envelope.version as number) > 2)) throw new Error('Unsupported draft version.')
                const draft = config as Record<string, unknown>
                if (typeof draft.name !== 'string' || (draft.blocks !== undefined && !Array.isArray(draft.blocks)) ||
                  (draft.blocks === undefined && (!Array.isArray(draft.pages) || draft.pages.length === 0))) throw new Error('Invalid editor draft.')
                if (draft.pages !== undefined && (!Array.isArray(draft.pages) || draft.pages.some(page =>
                  !page || typeof page !== 'object' || Array.isArray(page) || typeof page.id !== 'string' ||
                  typeof page.name !== 'string' || typeof page.path !== 'string' || !Array.isArray(page.blocks)
                ))) throw new Error('Invalid editor draft pages.')
                for (const blocks of [draft.blocks, ...(Array.isArray(draft.pages) ? draft.pages.map(page => page.blocks) : [])]) {
                  if (blocks === undefined) continue
                  if (!Array.isArray(blocks) || blocks.some(block => !block || typeof block !== 'object' || Array.isArray(block) ||
                    typeof block.id !== 'string' || typeof block.type !== 'string' || typeof block.variant !== 'string' ||
                    !block.props || typeof block.props !== 'object' || Array.isArray(block.props))) throw new Error('Invalid editor draft block.')
                }
                if (Array.isArray(draft.blocks) && Array.isArray(draft.pages) && draft.pages.length > 0 &&
                  !draft.pages.some(page => JSON.stringify(page.blocks) === JSON.stringify(draft.blocks))) throw new Error('Conflicting editor draft blocks.')
              }
              configDraftReadFailed = false
              return value
            } catch {
              configDraftReadFailed = true
              toast.error('Local drafts could not be read. Existing drafts are protected from overwrite; save any new work to a separate project file and restart to retry.', { id: 'draft-storage-read-failed', duration: Infinity, closeButton: true })
              return null
            }
          },
          setItem: (key, value) => {
            if (configDraftReadFailed) return
            try { window.localStorage.setItem(key, value) } catch {
              toast.error('Local draft storage failed. Save a separate project file before closing; recent edits may not survive a restart.', { id: 'draft-storage-failed', duration: Infinity, closeButton: true })
            }
          },
          removeItem: key => { if (!configDraftReadFailed) window.localStorage.removeItem(key) },
        }
      }),
      version: 2,
      partialize: (state) => ({ config: state.config, activePageId: state.activePageId }),
      migrate: (persisted, version) => {
        const data = persisted as Record<string, unknown>
        if (version === 0 || version === 1 || version === undefined) {
          // v0/v1 -> v2: wrap blocks[] into pages[]
          const config = data.config as SiteConfig | undefined
          if (config && !config.pages) {
            config.pages = [{ id: 'page-home', name: 'Home', path: '/', blocks: config.blocks || [] }]
          }
          data.activePageId = 'page-home'
          return data
        }
        return data
      },
    }
  )
)
