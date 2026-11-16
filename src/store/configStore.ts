import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { produce } from 'immer'
import { toast } from 'sonner'
import type { BlockConfig, SiteConfig, ThemeConfig, PageConfig } from '@/blocks/types'
import { validateProjectConfig } from '@/project/project-file'
import { pageLinkPath, visitBlockLinks } from '@/project/page-links'
import { normalizeGalleryBlock, normalizeGalleryConfig } from '@/blocks/gallery/gallery-photos'
import { useEditorStore } from './editorStore'

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
  updateBlockProps: (id: string, props: Record<string, unknown>, historyLabel?: string) => void
  updateMultipleBlockProps: (changes: Array<{ id: string; props: Record<string, unknown> }>) => void
  editBlockItems: (id: string, field: string, from: number, to: number, operation?: 'move' | 'remove' | 'duplicate') => void
  addGalleryImages: (id: string, images: Record<string, unknown>[]) => number
  movePlacedMedia: (fromId: string, toId: string, itemId: string, x: number, y: number, width: number) => void
  moveSectionObject: (fromId: string, fromSection: number, toId: string, toSection: number, itemId: string, x: number, y: number, width: number, height: number) => void
  moveCollageBlockToSection: (fromId: string, toId: string, section: number, x: number, y: number) => void
  addBlock: (block: BlockConfig, index?: number) => void
  removeBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  shareSectionAcrossPages: (id: string) => void
  unshareSection: (id: string) => void
  saveReusableSection: (blockId: string, name: string) => void
  removeReusableSection: (id: string) => void
  insertReusableSection: (id: string) => void
  moveBlock: (fromIndex: number, toIndex: number) => void
  addPage: (name: string, path: string) => string
  duplicatePage: (id: string) => void
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
        config = normalizeGalleryConfig(config)
        const pages = ensurePages(config)
        set({ config: { ...config, pages }, activePageId: pages[0]?.id ?? 'page-home', undoStack: [], redoStack: [] })
      },
      replaceConfig: (config, label = 'Edit project JSON') => set(state => ({
        ...pushUndo(state, label),
        config: normalizeGalleryConfig(config),
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
            if (block) {
              const sharedId = block.webstudioSharedSectionId
              for (const item of draft.pages!.flatMap(item => item.blocks)) {
                if (item === block || (sharedId && item.webstudioSharedSectionId === sharedId)) Object.assign(item, updates)
              }
            }
            draft.blocks = (draft.pages!.find(p => p.path === '/') ?? draft.pages![0]).blocks
          }),
        })),

      updateBlockProps: (id, props, historyLabel) =>
        set((state) => ({
          ...pushUndo(state, historyLabel || 'Update properties'),
          config: produce(withPages(state.config), (draft) => {
            const page = draft.pages!.find((p) => p.id === state.activePageId)
            if (!page) return
            const block = page.blocks.find((b) => b.id === id)
            if (block) {
              const sharedId = block.webstudioSharedSectionId
              for (const item of draft.pages!.flatMap(item => item.blocks)) {
                if (item === block || (sharedId && item.webstudioSharedSectionId === sharedId)) {
                  Object.assign(item.props, structuredClone(props))
                  if (item.type === 'gallery') item.props = normalizeGalleryBlock(item).props
                }
              }
            }
            draft.blocks = (draft.pages!.find(p => p.path === '/') ?? draft.pages![0]).blocks
          }),
        })),

      updateMultipleBlockProps: (changes) => set(state => ({
        ...pushUndo(state, 'Move selected objects'),
        config: produce(withPages(state.config), draft => {
          const page = draft.pages!.find(item => item.id === state.activePageId)
          if (!page) return
          for (const change of changes) {
            const block = page.blocks.find(item => item.id === change.id)
            if (!block) continue
            const sharedId = block.webstudioSharedSectionId
            for (const item of draft.pages!.flatMap(value => value.blocks)) if (item === block || (sharedId && item.webstudioSharedSectionId === sharedId)) Object.assign(item.props, structuredClone(change.props))
          }
          draft.blocks = (draft.pages!.find(item => item.path === '/') ?? draft.pages![0]).blocks
        }),
      })),

      addGalleryImages: (id, images) => {
        const block = get().getActivePageBlocks().find(item => item.id === id)
        if (block?.type !== 'gallery') throw new Error('The gallery is no longer available.')
        if (images.some(image => typeof image.src !== 'string' || !image.src.trim())) throw new Error('Choose an image for the gallery.')
        const existing = Array.isArray(block.props.images) ? block.props.images : []
        if (images.length) get().updateBlockProps(id, { images: [...existing, ...images.map(image => ({ ...image, id: `photo-${crypto.randomUUID()}` }))] })
        return existing.length
      },

      editBlockItems: (id, field, from, to, operation = 'move') => {
        const block = get().getActivePageBlocks().find(item => item.id === id)
        const items = block?.props[field]
        if (!block || !Array.isArray(items) || !Number.isInteger(from) || from < 0 || from >= items.length) return
        if (operation === 'move' && (!Number.isInteger(to) || to < 0 || to >= items.length || from === to)) return
        const updated = [...items]
        if (operation === 'remove') updated.splice(from, 1)
        else if (operation === 'duplicate') {
          const copy = structuredClone(updated[from])
          if (block.type === 'gallery' && field === 'images') copy.id = `photo-${crypto.randomUUID()}`
          if (/^section[1-4]Objects$/.test(field) && copy && typeof copy === 'object') {
            const object = copy as Record<string, unknown>
            object.id = `object-${crypto.randomUUID()}`
            object.x = Math.max(0, Math.min(100 - (Number(object.width) || 30), (Number(object.x) || 0) + 2))
            object.y = Math.max(0, (Number(object.y) || 0) + 12)
            object.layer = Math.max(0, ...items.map(item => Number((item as Record<string, unknown>)?.layer) || 0)) + 1
          }
          updated.splice(from + 1, 0, copy)
        }
        else { const [moved] = updated.splice(from, 1); updated.splice(to, 0, moved) }
        const changes: Record<string, unknown> = { [field]: updated }
        if (operation === 'duplicate' && /^section[1-4]Objects$/.test(field)) {
          const source = items[from] as { id?: unknown }, copy = updated[from + 1] as { id?: unknown }
          if (typeof source?.id === 'string' && typeof copy?.id === 'string') {
            const fromKey = `sectionObject_${source.id}`, toKey = `sectionObject_${copy.id}`
            if (block.props[fromKey] !== undefined) changes[toKey] = structuredClone(block.props[fromKey])
            if (block.props[`${fromKey}Rich`] !== undefined) changes[`${toKey}Rich`] = structuredClone(block.props[`${fromKey}Rich`])
          }
        }
        const text = block.props.textAdjustments && typeof block.props.textAdjustments === 'object' && !Array.isArray(block.props.textAdjustments) ? block.props.textAdjustments as Record<string, unknown> : {}
        const images = block.props.imageAdjustments && typeof block.props.imageAdjustments === 'object' && !Array.isArray(block.props.imageAdjustments) ? block.props.imageAdjustments as Record<string, unknown> : {}
        if (!/^section[1-4]Objects$/.test(field) && (Object.keys(text).length || Object.keys(images).length)) {
          const wrapper = typeof document === 'undefined' ? undefined : Array.from(document.querySelectorAll('[data-webstudio-block-id]')).find(element => element.getAttribute('data-webstudio-block-id') === id)
          const clone = wrapper?.cloneNode(true) as HTMLElement | undefined
          const cards = Array.from(clone?.querySelectorAll<HTMLElement>('[data-ws-item-field][data-ws-item-index]') ?? []).filter(element => element.dataset.wsItemField === field)
          const source = cards.find(element => Number(element.dataset.wsItemIndex) === from), target = cards.find(element => Number(element.dataset.wsItemIndex) === to)
          if (cards.length !== items.length || !source || (operation === 'move' && (!target || source.parentElement !== target.parentElement))) throw new Error('This layout cannot yet change items with individual formatting; no data was changed.')
          const removedText = operation === 'remove' ? Array.from(source.querySelectorAll<HTMLElement>('[data-ws-text-key]')).map(element => element.dataset.wsTextKey ?? '') : []
          const removedImages = operation === 'remove' ? Array.from(source.querySelectorAll<HTMLElement>('img[data-ws-image-index]')).map(element => element.dataset.wsImageIndex ?? '') : []
          if (operation === 'remove' && source.dataset.wsTextKey !== undefined) removedText.push(source.dataset.wsTextKey)
          if (operation === 'remove') source.remove()
          else if (operation === 'duplicate') source.parentElement!.insertBefore(source.cloneNode(true), source.nextSibling)
          else target!.parentElement!.insertBefore(source, from < to ? target!.nextSibling : target!)
          const textMap: Record<string, string[]> = {}, imageMap: Record<string, string[]> = {}, counts: Record<string, number> = {}
          clone!.querySelectorAll<HTMLElement>('[data-ws-content] [data-ws-text-key]').forEach(element => {
            const tag = element.tagName.toLowerCase(), oldKey = element.dataset.wsTextKey ?? '', index = counts[tag] ?? 0
            counts[tag] = index + 1; (textMap[oldKey] ??= []).push(`${tag}-${index}`)
          })
          clone!.querySelectorAll<HTMLElement>('[data-ws-content] img').forEach((element, index) => { if (element.dataset.wsImageIndex !== undefined) (imageMap[element.dataset.wsImageIndex] ??= []).push(String(index)) })
          if (Object.keys(text).some(key => textMap[key] === undefined && !removedText.includes(key)) || Object.keys(images).some(key => imageMap[key] === undefined && !removedImages.includes(key))) throw new Error('Some adjusted items are not visible in this layout; no data was changed.')
          if (Object.keys(text).length) changes.textAdjustments = Object.fromEntries(Object.entries(text).flatMap(([key, value]) => (textMap[key] ?? []).map(next => [next, value])))
          if (Object.keys(images).length) changes.imageAdjustments = Object.fromEntries(Object.entries(images).flatMap(([key, value]) => (imageMap[key] ?? []).map(next => [next, value])))
        }
        get().updateBlockProps(id, changes)
        if (block.type === 'gallery' && field === 'images') {
          const editor = useEditorStore.getState(), selected = editor.selectedCompositeItem
          if (selected?.blockId === id && selected.field === field) {
            const selectedId = selected.id ?? items[selected.index]?.id
            const nextId = operation === 'duplicate' && selectedId === items[from]?.id ? updated[from + 1].id : selectedId
            const index = updated.findIndex(item => item.id === nextId)
            editor.selectCompositeItem(index < 0 ? null : { blockId: id, field, index, id: nextId })
            if (index >= 0) editor.selectImage(index)
          }
        }
      },

      movePlacedMedia: (fromId, toId, itemId, x, y, width) => set(state => {
        const page = ensurePages(state.config).find(p => p.id === state.activePageId)
        const source = page?.blocks.find(b => b.id === fromId)
        const target = page?.blocks.find(b => b.id === toId)
        const items = Array.isArray(source?.props.placedMedia) ? source.props.placedMedia : []
        const item = items.find(value => value && typeof value === 'object' && (value as { id?: unknown }).id === itemId)
        if (!source || !target || !item || fromId === toId) return state
        return {
          ...pushUndo(state, 'Move media'),
          config: produce(withPages(state.config), draft => {
            const active = draft.pages!.find(p => p.id === state.activePageId)!
            const from = active.blocks.find(b => b.id === fromId)!
            const to = active.blocks.find(b => b.id === toId)!
            for (const block of draft.pages!.flatMap(p => p.blocks)) {
              if (block === from || (from.webstudioSharedSectionId && block.webstudioSharedSectionId === from.webstudioSharedSectionId)) {
                block.props.placedMedia = (Array.isArray(block.props.placedMedia) ? block.props.placedMedia : []).filter(value => !value || typeof value !== 'object' || (value as { id?: unknown }).id !== itemId)
              }
              if (block === to || (to.webstudioSharedSectionId && block.webstudioSharedSectionId === to.webstudioSharedSectionId)) {
                const existing = Array.isArray(block.props.placedMedia) ? block.props.placedMedia : []
                block.props.placedMedia = [...existing, { ...structuredClone(item as Record<string, unknown>), x, y, width }]
              }
            }
            draft.blocks = (draft.pages!.find(p => p.path === '/') ?? draft.pages![0]).blocks
          }),
        }
      }),

      moveSectionObject: (fromId, fromSection, toId, toSection, itemId, x, y, width, height) => set(state => {
        if (fromSection < 1 || fromSection > 4 || toSection < 1 || toSection > 4 || (fromId === toId && fromSection === toSection)) return state
        const page = ensurePages(state.config).find(p => p.id === state.activePageId)
        const source = page?.blocks.find(b => b.id === fromId), target = page?.blocks.find(b => b.id === toId)
        const sourceKey = `section${fromSection}Objects`, targetKey = `section${toSection}Objects`
        const items = Array.isArray(source?.props[sourceKey]) ? source.props[sourceKey] as Record<string, unknown>[] : []
        const item = items.find(value => value && value.id === itemId)
        if (!source || !target || !item || toSection > Math.max(1, Number(target.props.sectionCount) || 1)) return state
        const moving = [item, ...items.filter(value => value?.parentId === itemId)]
        const movingIds = new Set(moving.map(value => value.id))
        return {
          ...pushUndo(state, 'Move section object'),
          config: produce(withPages(state.config), draft => {
            const active = draft.pages!.find(p => p.id === state.activePageId)!
            const from = active.blocks.find(b => b.id === fromId)!, to = active.blocks.find(b => b.id === toId)!
            for (const block of draft.pages!.flatMap(p => p.blocks)) {
              if (block === from || (from.webstudioSharedSectionId && block.webstudioSharedSectionId === from.webstudioSharedSectionId)) {
                block.props[sourceKey] = (Array.isArray(block.props[sourceKey]) ? block.props[sourceKey] as Record<string, unknown>[] : []).filter(value => !value || !movingIds.has(value.id))
              }
              if (block === to || (to.webstudioSharedSectionId && block.webstudioSharedSectionId === to.webstudioSharedSectionId)) {
                const existing = Array.isArray(block.props[targetKey]) ? block.props[targetKey] : []
                const ratio = Number(item.width) > 0 ? width / Number(item.width) : 1
                block.props[targetKey] = [...existing, ...moving.map(value => {
                  if (value.id !== itemId) return { ...structuredClone(value), x: x + (Number(value.x) - Number(item.x)) * ratio, y: y + Number(value.y) - Number(item.y), width: Number(value.width) * ratio }
                  const result: Record<string, unknown> = { ...structuredClone(value), x, y, width, height }
                  delete result.parentId
                  return result
                })]
                for (const value of moving) for (const suffix of ['', 'Rich']) {
                  const prop = `sectionObject_${value.id}${suffix}`
                  if (from.props[prop] !== undefined) block.props[prop] = from.props[prop]
                }
              }
            }
            if (fromId !== toId) for (const block of draft.pages!.flatMap(p => p.blocks)) {
              if (block === from || (from.webstudioSharedSectionId && block.webstudioSharedSectionId === from.webstudioSharedSectionId)) for (const value of moving) {
                delete block.props[`sectionObject_${value.id}`]; delete block.props[`sectionObject_${value.id}Rich`]
              }
            }
            draft.blocks = (draft.pages!.find(p => p.path === '/') ?? draft.pages![0]).blocks
          }),
        }
      }),

      moveCollageBlockToSection: (fromId, toId, section, x, y) => set(state => {
        const page = ensurePages(state.config).find(p => p.id === state.activePageId)
        const from = page?.blocks.find(block => block.id === fromId)
        const to = page?.blocks.find(block => block.id === toId)
        if (!from || from.type !== 'collage' || !to || from === to || section < 1 || section > Math.max(1, Number(to.props.sectionCount) || 1)) throw new Error('Choose a different section on this page.')
        if (from.webstudioSharedSectionId || Object.entries(from.props).some(([key, value]) => /^section[1-4](Objects|Items|Text|Image)$/.test(key) && (Array.isArray(value) ? value.length > 0 : !!value))) throw new Error('This collage has shared or additional section content. Move that content first so it is not lost.')
        const key = `section${section}Objects`
        const id = `object-${crypto.randomUUID()}`
        const current = Array.isArray(to.props[key]) ? to.props[key] as Record<string, unknown>[] : []
        const item = { id, type: 'collage', images: structuredClone(Array.isArray(from.props.images) ? from.props.images : []), sourceCollageProps: structuredClone(from.props), x: Math.max(0, Math.min(65, x)), y: Math.max(0, y), width: 35, height: 240, layer: Math.max(0, ...current.map(value => Number(value.layer) || 0)) + 1 }
        return { ...pushUndo(state, 'Move collage into section'), config: produce(withPages(state.config), draft => {
          const active = draft.pages!.find(p => p.id === state.activePageId)!
          const target = active.blocks.find(block => block.id === toId)!
          for (const block of draft.pages!.flatMap(p => p.blocks)) if (block === target || (target.webstudioSharedSectionId && block.webstudioSharedSectionId === target.webstudioSharedSectionId)) {
            const existing = Array.isArray(block.props[key]) ? block.props[key] : []
            block.props[key] = [...existing, structuredClone(item)]
          }
          active.blocks = active.blocks.filter(block => block.id !== fromId)
          draft.blocks = (draft.pages!.find(p => p.path === '/') ?? draft.pages![0]).blocks
        }) }
      }),

      addBlock: (block, index) =>
        set((state) => ({
          ...pushUndo(state, 'Add block'),
          config: mutateActivePageBlocks(withPages(state.config), state.activePageId, (blocks) => {
            if (block.type === 'navbar') {
              blocks.unshift(normalizeGalleryBlock(block))
            } else if (index !== undefined) {
              blocks.splice(index, 0, normalizeGalleryBlock(block))
            } else {
              blocks.push(normalizeGalleryBlock(block))
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
          delete clone.webstudioSharedSectionId
          return {
            ...pushUndo(state, 'Duplicate block'),
            config: mutateActivePageBlocks(withPages(state.config), state.activePageId, (b) => {
              b.splice(idx + 1, 0, clone)
              return b
            }),
          }
        }),

      shareSectionAcrossPages: (id) => set(state => {
        const pages = ensurePages(state.config)
        const original = getPageBlocks(state.config, state.activePageId).find(block => block.id === id)
        if (!original || !['navbar', 'footer'].includes(original.type)) throw new Error('Select a header or footer first.')
        if (original.webstudioSharedSectionId) return state
        if (pages.some(page => page.blocks.some(block => block.type === original.type && block.id !== id))) {
          throw new Error(`Remove other ${original.type === 'navbar' ? 'headers' : 'footers'} before sharing this one across pages.`)
        }
        const sharedId = `shared-${crypto.randomUUID()}`
        const updatedPages = pages.map(page => {
          if (page.id === state.activePageId) return { ...page, blocks: page.blocks.map(block => block.id === id ? { ...block, webstudioSharedSectionId: sharedId } : block) }
          const copy = { ...structuredClone(original), id: `block-${crypto.randomUUID()}`, webstudioSharedSectionId: sharedId }
          return { ...page, blocks: original.type === 'navbar' ? [copy, ...page.blocks] : [...page.blocks, copy] }
        })
        return { ...pushUndo(state, 'Share section across pages'), config: { ...state.config, pages: updatedPages, blocks: (updatedPages.find(page => page.path === '/') ?? updatedPages[0]).blocks } }
      }),

      unshareSection: (id) => set(state => {
        const original = getPageBlocks(state.config, state.activePageId).find(block => block.id === id)
        const sharedId = original?.webstudioSharedSectionId
        if (!sharedId) return state
        const pages = ensurePages(state.config).map(page => ({ ...page, blocks: page.blocks.map(block => {
          if (block.webstudioSharedSectionId !== sharedId) return block
          const copy = { ...block }; delete copy.webstudioSharedSectionId; return copy
        }) }))
        return { ...pushUndo(state, 'Stop sharing section'), config: { ...state.config, pages, blocks: (pages.find(page => page.path === '/') ?? pages[0]).blocks } }
      }),

      saveReusableSection: (blockId, name) => set(state => {
        const block = getPageBlocks(state.config, state.activePageId).find(item => item.id === blockId)
        if (!block || !name.trim()) return state
        const savedBlock = structuredClone(block)
        delete savedBlock.webstudioSharedSectionId
        const section = { id: `section-${crypto.randomUUID()}`, name: name.trim(), block: savedBlock }
        return { ...pushUndo(state, 'Save reusable section'), config: { ...state.config, webstudioReusableSections: [...(state.config.webstudioReusableSections ?? []), section] } }
      }),

      removeReusableSection: (id) => set(state => {
        const sections = state.config.webstudioReusableSections ?? []
        if (!sections.some(section => section.id === id)) return state
        return { ...pushUndo(state, 'Remove reusable section'), config: { ...state.config, webstudioReusableSections: sections.filter(section => section.id !== id) } }
      }),

      insertReusableSection: (id) => set(state => {
        const section = state.config.webstudioReusableSections?.find(item => item.id === id)
        if (!section) return state
        const block = { ...structuredClone(section.block), id: `block-${crypto.randomUUID()}` }
        return { ...pushUndo(state, 'Insert reusable section'), config: mutateActivePageBlocks(withPages(state.config), state.activePageId, blocks => block.type === 'navbar' ? [block, ...blocks] : [...blocks, block]) }
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
          const existingPages = ensurePages(state.config)
          const shared = new Map<string, BlockConfig>()
          for (const block of existingPages.flatMap(page => page.blocks)) {
            if (block.webstudioSharedSectionId && !shared.has(block.webstudioSharedSectionId)) shared.set(block.webstudioSharedSectionId, block)
          }
          const sharedBlocks = [...shared.values()].map(block => ({ ...structuredClone(block), id: `block-${crypto.randomUUID()}` }))
          const pages = [...existingPages, { id, name, path, blocks: sharedBlocks }]
          const config = validateProjectConfig({ ...state.config, pages })
          return { ...pushUndo(state, 'Add page'), config, activePageId: id }
        })
        return id
      },

      duplicatePage: (id) => set(state => {
        const pages = ensurePages(state.config)
        const index = pages.findIndex(page => page.id === id)
        if (index < 0) throw new Error('Page no longer exists.')
        const source = pages[index]
        const base = source.path === '/' ? '/home-copy' : `${source.path}-copy`
        let path = base
        let number = 2
        while (pages.some(page => page.path.toLowerCase() === path.toLowerCase())) path = `${base}-${number++}`
        const copy = structuredClone(source)
        copy.id = `page-${crypto.randomUUID()}`
        copy.name = `${source.name} copy`
        copy.path = path
        copy.blocks = copy.blocks.map(block => ({ ...block, id: `block-${crypto.randomUUID()}` }))
        if (copy.webstudioArticle) copy.webstudioArticle.status = 'draft'
        const newPages = [...pages]
        newPages.splice(index + 1, 0, copy)
        const config = validateProjectConfig({ ...state.config, pages: newPages })
        return { ...pushUndo(state, 'Duplicate page'), config, activePageId: copy.id }
      }),

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
          if (updateLinks) {
            const oldPaths = new Set([page.path, encodeURI(page.path)])
            const rewrite = (destination: string) => {
              if (!/^\/(?!\/)/.test(destination) || !oldPaths.has(pageLinkPath(destination))) return
              const suffix = destination.search(/[?#]/)
              return path + (suffix < 0 ? '' : destination.slice(suffix))
            }
            for (const item of draft.pages!) for (const block of item.blocks) visitBlockLinks(block, rewrite)
            for (const section of draft.webstudioReusableSections ?? []) visitBlockLinks(section.block, rewrite)
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
                if (draft.webstudioReusableSections !== undefined && (!Array.isArray(draft.webstudioReusableSections) || draft.webstudioReusableSections.some(section =>
                  !section || typeof section !== 'object' || Array.isArray(section) || typeof section.id !== 'string' ||
                  typeof section.name !== 'string' || !section.block || typeof section.block !== 'object' || Array.isArray(section.block) ||
                  typeof section.block.id !== 'string' || typeof section.block.type !== 'string' || typeof section.block.variant !== 'string' ||
                  !section.block.props || typeof section.block.props !== 'object' || Array.isArray(section.block.props)
                ))) throw new Error('Invalid reusable sections in editor draft.')
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
      merge: (persisted, current) => {
        const saved = persisted as Partial<ConfigState> | undefined
        return { ...current, ...saved, ...(saved?.config ? { config: normalizeGalleryConfig(saved.config) } : {}) }
      },
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
