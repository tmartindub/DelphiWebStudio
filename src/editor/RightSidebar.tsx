import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MousePointer2 } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { useConfigStore } from '@/store/configStore'
import { PropertiesPanel } from './PropertiesPanel'
import { DesignPanel } from './DesignPanel'

type Tab = 'properties' | 'design'

export function RightSidebar({ collapsed = false, onClose }: { collapsed?: boolean; onClose?: () => void }) {
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const selectedObject = useEditorStore((s) => s.selectedSectionObject)
  const selectedCompositeItem = useEditorStore((s) => s.selectedCompositeItem)
  const selectedPlacedMedia = useEditorStore((s) => s.selectedPlacedMedia)
  const scrollRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const mode = useEditorStore((s) => s.mode)
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  const objectKey = selectedObject ? `${selectedObject.blockId}:${selectedObject.section}:${selectedObject.id}` : selectedCompositeItem ? `${selectedCompositeItem.blockId}:${selectedCompositeItem.field}:${selectedCompositeItem.id ?? selectedCompositeItem.index}` : selectedPlacedMedia ? `${selectedPlacedMedia.blockId}:${selectedPlacedMedia.id}` : ''
  const [selection, setSelection] = useState<{ blockId: string | null; objectKey: string; tab: Tab }>({
    blockId: null, objectKey: '', tab: mode === 'designer' ? 'design' : 'properties',
  })
  if (selection.blockId !== selectedBlockId || selection.objectKey !== objectKey) {
    setSelection({ blockId: selectedBlockId, objectKey, tab: selectedBlock ? 'properties' : selection.tab })
  }
  useEffect(() => {
    if (collapsed) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    windowRef.current?.querySelector<HTMLElement>('[aria-label="Close settings"]')?.focus({ preventScroll: true })
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [collapsed])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [selectedBlockId, objectKey])
  useEffect(() => {
    const element = windowRef.current
    if (collapsed || !element) return
    const keepVisible = () => {
      const bounds = element.getBoundingClientRect()
      element.style.left = `${Math.max(0, Math.min(bounds.left, window.innerWidth - bounds.width))}px`
      element.style.right = 'auto'
      element.style.top = `${Math.max(8, Math.min(bounds.top, window.innerHeight - bounds.height - 24))}px`
    }
    const observer = new ResizeObserver(keepVisible)
    observer.observe(element)
    window.addEventListener('resize', keepVisible)
    return () => { observer.disconnect(); window.removeEventListener('resize', keepVisible) }
  }, [collapsed])
  const activeTab = selectedBlock && (selection.blockId !== selectedBlock.id || selection.objectKey !== objectKey)
    ? 'properties'
    : selection.tab

  useLayoutEffect(() => {
    const windowElement = windowRef.current
    if (collapsed || !windowElement) return
    const blockElement = Array.from(document.querySelectorAll<HTMLElement>('[data-webstudio-block-id]')).find(element => element.dataset.webstudioBlockId === selectedBlockId)
    const target = selectedObject ? Array.from(blockElement?.querySelectorAll<HTMLElement>('[data-section-object]') ?? []).find(element => element.dataset.sectionObject === selectedObject.id) ?? blockElement : selectedCompositeItem ? Array.from(blockElement?.querySelectorAll<HTMLElement>('[data-ws-item-field]') ?? []).find(element => element.dataset.wsItemField === selectedCompositeItem.field && Number(element.dataset.wsItemIndex) === selectedCompositeItem.index) ?? blockElement : selectedPlacedMedia ? Array.from(blockElement?.querySelectorAll<HTMLElement>('[data-placed-media]') ?? []).find(element => element.dataset.placedMedia === selectedPlacedMedia.id) ?? blockElement : blockElement
    const targetBounds = target?.getBoundingClientRect(), bounds = windowElement.getBoundingClientRect(), gap = 12
    let left = window.innerWidth - bounds.width - gap, top = 24
    try { const saved = JSON.parse(localStorage.getItem('webstudio-properties-position') || 'null'); if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) { left = saved.left; top = saved.top } } catch { /* Automatic placement remains available. */ }
    if (targetBounds && activeTab === 'properties') {
      if (targetBounds.right + gap + bounds.width <= window.innerWidth) left = targetBounds.right + gap
      else if (targetBounds.left - gap >= bounds.width) left = targetBounds.left - gap - bounds.width
      else if (targetBounds.bottom + gap + bounds.height <= window.innerHeight) { left = targetBounds.left; top = targetBounds.bottom + gap }
      else if (targetBounds.top - gap >= bounds.height) { left = targetBounds.left; top = targetBounds.top - gap - bounds.height }
      top = top === 24 ? targetBounds.top : top
    }
    windowElement.style.right = 'auto'
    windowElement.style.left = `${Math.max(0, Math.min(left, window.innerWidth - bounds.width))}px`
    windowElement.style.top = `${Math.max(8, Math.min(top, window.innerHeight - bounds.height - 24))}px`
  }, [collapsed, selectedBlockId, objectKey, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={windowRef} id="editor-right-panel" role="dialog" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose?.() } }} aria-label="Editor settings" aria-modal="false" className={collapsed ? 'hidden' : 'fixed studio-window z-[100] flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-1 shadow-2xl'} style={{ width: 'min(460px, calc(100vw - 24px))', maxHeight: 'min(620px, calc(100vh - 48px))', right: 16, top: 72, color: '#172033', '--color-bg-1': '#ffffff', '--color-bg-2': '#f7f9fc', '--color-bg-3': '#eaf1f9', '--color-bg-4': '#dce9f7', '--color-border-default': '#64748b', '--color-border-subtle': '#64748b', '--color-text-0': '#172033', '--color-text-1': '#253550', '--color-text-2': '#45566f', '--color-text-3': '#62738b', '--color-green': '#1769ca', '--color-green-dim': '#1457a8', '--color-green-glow': '#e8f1ff' } as React.CSSProperties}>
      <div className="flex shrink-0 items-center justify-between rounded-t-lg border-b border-border-default bg-bg-2 px-3 py-2" style={{ cursor: 'move', touchAction: 'none' }} title="Drag to move the settings window" onPointerDown={event => {
        if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return
        const rect = windowRef.current?.getBoundingClientRect(); if (!rect) return
        dragRef.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
        event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault()
      }} onPointerMove={event => {
        const drag = dragRef.current; const rect = windowRef.current?.getBoundingClientRect(); if (!drag || !rect) return
        if (windowRef.current) { windowRef.current.style.right = 'auto'; windowRef.current.style.left = `${Math.max(0, Math.min(window.innerWidth - rect.width, drag.left + event.clientX - drag.x))}px`; windowRef.current.style.top = `${Math.max(8, Math.min(window.innerHeight - rect.height - 24, drag.top + event.clientY - drag.y))}px` }
      }} onPointerUp={() => { if (dragRef.current && windowRef.current) { const rect = windowRef.current.getBoundingClientRect(); try { localStorage.setItem('webstudio-properties-position', JSON.stringify({ left: rect.left, top: rect.top })) } catch { /* Position is optional. */ } }; dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}>
        <span className="text-xs font-semibold text-text-0">{activeTab === 'design' ? 'Site design' : selectedObject || selectedCompositeItem || selectedPlacedMedia ? 'Object settings' : selectedBlock ? `${selectedBlock.type === 'navbar' ? 'Navigation' : selectedBlock.type === 'cta' ? 'Button section' : selectedBlock.type.charAt(0).toUpperCase() + selectedBlock.type.slice(1)} properties` : 'Settings'}</span>
        <button type="button" aria-label="Close settings" onClick={onClose} className="rounded px-2 py-1 text-base text-text-1 hover:bg-bg-3">×</button>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-border-default shrink-0">
        <button
          data-properties-tab
          onClick={() => setSelection({ blockId: selectedBlockId, objectKey, tab: 'properties' })}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            activeTab === 'properties'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setSelection({ blockId: selectedBlockId, objectKey, tab: 'design' })}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            activeTab === 'design'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Site design
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'design' ? (
          <DesignPanel />
        ) : selectedBlock ? (
          <>
            <PropertiesPanel block={selectedBlock} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
            <div className="w-10 h-10 rounded-lg bg-bg-3 border border-border-default flex items-center justify-center">
              <MousePointer2 size={16} className="text-text-3" />
            </div>
            <div>
              <p className="text-text-1 text-[12px] font-medium">Click a block to edit</p>
              <p className="text-text-3 text-[11px] mt-1">Select any block on the canvas to see its properties here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
