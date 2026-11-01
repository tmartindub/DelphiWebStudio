import { create } from 'zustand'

export type Viewport = 'desktop' | 'tablet' | 'mobile'
export type EditorMode = 'beginner' | 'designer' | 'professional'
export type PendingMediaImport = { projectId: string; files: File[]; allowZip: boolean; duplicateMode: 'reuse' | 'keep' | 'skip' }

interface EditorState {
  selectedBlockId: string | null
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
  // Generation state
  isGenerating: boolean
  generationPrompt: string | null
  generationError: string | null
  selectBlock: (id: string | null) => void
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
  setGenerating: (prompt: string | null) => void
  setGenerationError: (err: string | null) => void
  clearGeneration: () => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  selectedBlockId: null,
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
  isGenerating: false,
  generationPrompt: null,
  generationError: null,
  selectBlock: (id) => set({ selectedBlockId: id }),
  setViewport: (vp) => set({ viewport: vp, customViewportWidth: null }),
  setCustomViewportWidth: (width) => set(Number.isFinite(width) ? { customViewportWidth: Math.max(320, Math.min(1920, Math.round(width))) } : {}),
  setMode: (mode) => set({ mode, jsonDrawerOpen: mode === 'professional' }),
  setMediaImporting: (mediaImporting) => set({ mediaImporting }),
  setPendingMediaImport: (pendingMediaImport) => set({ pendingMediaImport }),
  toggleJsonDrawer: () => set((s) => ({ jsonDrawerOpen: !s.jsonDrawerOpen })),
  toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
  toggleShortcutsModal: () => set((s) => ({ shortcutsModalOpen: !s.shortcutsModalOpen })),
  togglePreview: () => set((s) => ({ previewMode: !s.previewMode, ...(!s.previewMode ? { selectedBlockId: null } : {}) })),
  setActiveProject: (id) => set({ activeProjectId: id }),
  setGenerating: (prompt) => set({ isGenerating: !!prompt, generationPrompt: prompt, generationError: null }),
  setGenerationError: (err) => set({ generationError: err }),
  clearGeneration: () => set({ isGenerating: false, generationPrompt: null }),
}))
