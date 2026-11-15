import { create } from 'zustand'

export type Viewport = 'desktop' | 'tablet' | 'mobile'
export type EditorMode = 'beginner' | 'designer' | 'professional'
export type PendingMediaImport = { projectId: string; files: File[]; allowZip: boolean; duplicateMode: 'reuse' | 'keep' | 'skip'; folder?: string }

interface EditorState {
  selectedBlockId: string | null
  selectedImageIndex: number
  selectedTextKey: string
  selectedSection: number
  selectedSectionObject: { blockId: string; section: number; id: string } | null
  selectedSectionObjects: Array<{ blockId: string; section: number; id: string }>
  toggleSectionObject: (value: NonNullable<EditorState['selectedSectionObject']>) => void
  setSectionObjects: (value: EditorState['selectedSectionObjects']) => void
  selectionPreference: 'parent' | 'child'
  setSelectionPreference: (value: EditorState['selectionPreference']) => void
  savedProjectSnapshot: { projectId: string; signature: string } | null
  fileLocations: Record<string, { path: string; savedAt?: string }>
  setFileLocation: (projectId: string, path: string, savedAt?: string) => void
  setSavedProjectSnapshot: (value: EditorState['savedProjectSnapshot']) => void
  selectSectionObject: (value: EditorState['selectedSectionObject']) => void
  selectedCompositeItem: { blockId: string; field: string; index: number; id?: string } | null
  selectCompositeItem: (value: EditorState['selectedCompositeItem']) => void
  selectedPlacedMedia: { blockId: string; id: string } | null
  selectPlacedMedia: (value: EditorState['selectedPlacedMedia']) => void
  copiedSectionObject: { token: string; projectId: string | null; item: Record<string, unknown>; text?: unknown; rich?: unknown } | null
  textPlacement: { projectId: string | null; pageId: string | null; kind?: 'text' | 'panel' | 'divider'; text?: string; fontSize?: number; lineOrientation?: 'horizontal' | 'vertical'; lineStyle?: 'solid' | 'dashed' | 'dotted' | 'double'; lineThickness?: number } | null
  mediaPlacement: { projectId: string; pageId: string; id: string; path: string; name: string; width?: number; height?: number } | null
  setMediaPlacement: (value: EditorState['mediaPlacement']) => void
  newTextObjectId: string | null
  movingCollage: { blockId: string; projectId: string | null; pageId: string } | null
  setMovingCollage: (value: EditorState['movingCollage']) => void
  setTextPlacement: (value: EditorState['textPlacement']) => void
  setNewTextObjectId: (id: string | null) => void
  viewport: Viewport
  customViewportWidth: number | null
  mode: EditorMode
  mediaImporting: boolean
  pendingMediaImport: PendingMediaImport | null
  jsonDrawerOpen: boolean
  historyOpen: boolean
  shortcutsModalOpen: boolean
  previewMode: boolean
  activeProjectId: string | null
  deploymentKeys: Record<string, string>
  // Generation state
  isGenerating: boolean
  generationPrompt: string | null
  generationError: string | null
  selectBlock: (id: string | null) => void
  selectImage: (index: number) => void
  selectText: (key: string) => void
  selectSection: (section: number) => void
  setCopiedSectionObject: (value: EditorState['copiedSectionObject']) => void
  setViewport: (vp: Viewport) => void
  setCustomViewportWidth: (width: number) => void
  setMode: (mode: EditorMode) => void
  setMediaImporting: (importing: boolean) => void
  setPendingMediaImport: (pending: PendingMediaImport | null) => void
  toggleJsonDrawer: () => void
  toggleHistory: () => void
  toggleShortcutsModal: () => void
  togglePreview: () => void
  setActiveProject: (id: string | null) => void
  setDeploymentKey: (projectId: string, key: string) => void
  setGenerating: (prompt: string | null) => void
  setGenerationError: (err: string | null) => void
  clearGeneration: () => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  selectedBlockId: null,
  selectedImageIndex: 0,
  selectedTextKey: '',
  selectedSection: 0,
  selectedSectionObject: null,
  selectedSectionObjects: [],
  selectionPreference: typeof window !== 'undefined' && (() => { try { return window.localStorage.getItem('webstudio-selection-preference') === 'child' } catch { return false } })() ? 'child' : 'parent',
  savedProjectSnapshot: null,
  fileLocations: {},
  setFileLocation: (projectId, path, savedAt) => set(state => ({ fileLocations: { ...state.fileLocations, [projectId]: { path, savedAt } } })),
  setSavedProjectSnapshot: (savedProjectSnapshot) => set({ savedProjectSnapshot }),
  setSelectionPreference: (selectionPreference) => { try { window.localStorage.setItem('webstudio-selection-preference', selectionPreference) } catch { /* Selection still works for this session. */ }; set({ selectionPreference }) },
  selectSectionObject: (selectedSectionObject) => set({ selectedSectionObject, selectedSectionObjects: selectedSectionObject ? [selectedSectionObject] : [], ...(selectedSectionObject ? { selectedCompositeItem: null, selectedPlacedMedia: null } : {}) }),
  setSectionObjects: (selectedSectionObjects) => set({ selectedSectionObjects, selectedSectionObject: selectedSectionObjects.at(-1) ?? null, selectedCompositeItem: null, selectedPlacedMedia: null }),
  toggleSectionObject: (value) => set(state => {
    const exists = state.selectedSectionObjects.some(item => item.blockId === value.blockId && item.section === value.section && item.id === value.id)
    const selectedSectionObjects = exists ? state.selectedSectionObjects.filter(item => !(item.blockId === value.blockId && item.section === value.section && item.id === value.id)) : [...state.selectedSectionObjects, value]
    return { selectedSectionObjects, selectedSectionObject: selectedSectionObjects.at(-1) ?? null, selectedCompositeItem: null, selectedPlacedMedia: null }
  }),
  selectedCompositeItem: null,
  selectCompositeItem: (selectedCompositeItem) => set({ selectedCompositeItem, ...(selectedCompositeItem ? { selectedSectionObject: null, selectedSectionObjects: [], selectedPlacedMedia: null } : {}) }),
  selectedPlacedMedia: null,
  selectPlacedMedia: (selectedPlacedMedia) => set({ selectedPlacedMedia, ...(selectedPlacedMedia ? { selectedSectionObject: null, selectedSectionObjects: [], selectedCompositeItem: null } : {}) }),
  copiedSectionObject: null,
  textPlacement: null,
  mediaPlacement: null,
  setMediaPlacement: (mediaPlacement) => set({ mediaPlacement, textPlacement: null }),
  newTextObjectId: null,
  movingCollage: null,
  setMovingCollage: (movingCollage) => set({ movingCollage }),
  setTextPlacement: (textPlacement) => set({ textPlacement, mediaPlacement: null }),
  setNewTextObjectId: (newTextObjectId) => set({ newTextObjectId }),
  viewport: 'desktop',
  customViewportWidth: null,
  mode: 'beginner',
  mediaImporting: false,
  pendingMediaImport: null,
  jsonDrawerOpen: false,
  historyOpen: false,
  shortcutsModalOpen: false,
  previewMode: false,
  activeProjectId: null,
  deploymentKeys: {},
  isGenerating: false,
  generationPrompt: null,
  generationError: null,
  selectBlock: (id) => set(state => ({ selectedBlockId: id, ...(state.selectedBlockId !== id ? { selectedImageIndex: 0, selectedTextKey: '', selectedSection: 0, selectedSectionObject: null, selectedSectionObjects: [], selectedCompositeItem: null, selectedPlacedMedia: null } : {}) })),
  selectImage: (index) => set({ selectedImageIndex: Math.max(0, Math.floor(index)) }),
  selectText: (key) => set({ selectedTextKey: key }),
  selectSection: (section) => set({ selectedSection: Math.max(1, Math.min(4, Math.floor(section))) }),
  setCopiedSectionObject: (copiedSectionObject) => set({ copiedSectionObject }),
  setViewport: (vp) => set({ viewport: vp, customViewportWidth: null }),
  setCustomViewportWidth: (width) => set(Number.isFinite(width) ? { customViewportWidth: Math.max(320, Math.min(1920, Math.round(width))) } : {}),
  setMode: (mode) => set({ mode, jsonDrawerOpen: mode === 'professional' }),
  setMediaImporting: (mediaImporting) => set({ mediaImporting }),
  setPendingMediaImport: (pendingMediaImport) => set({ pendingMediaImport }),
  toggleJsonDrawer: () => set((s) => ({ jsonDrawerOpen: !s.jsonDrawerOpen })),
  toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
  toggleShortcutsModal: () => set((s) => ({ shortcutsModalOpen: !s.shortcutsModalOpen })),
  togglePreview: () => set((s) => ({ previewMode: !s.previewMode, textPlacement: null, mediaPlacement: null, movingCollage: null, ...(!s.previewMode ? { selectedBlockId: null } : {}) })),
  setActiveProject: (id) => set({ activeProjectId: id, textPlacement: null, mediaPlacement: null, movingCollage: null }),
  setDeploymentKey: (projectId, key) => set(state => ({ deploymentKeys: { ...state.deploymentKeys, [projectId]: key } })),
  setGenerating: (prompt) => set({ isGenerating: !!prompt, generationPrompt: prompt, generationError: null }),
  setGenerationError: (err) => set({ generationError: err }),
  clearGeneration: () => set({ isGenerating: false, generationPrompt: null }),
}))
