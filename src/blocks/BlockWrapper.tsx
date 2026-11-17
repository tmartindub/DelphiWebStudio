import { type ReactNode, type PointerEvent as ReactPointerEvent, useRef, useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Trash2, ChevronUp, ChevronDown, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import type { BlockConfig } from './types'
import { BlockColumns } from './BlockColumns'
import { PlacedMedia } from './PlacedMedia'

interface Props {
  block: BlockConfig
  readOnlyPreview?: string
  isSelected: boolean
  hiddenOnCurrentWidth?: boolean
  onSelect: () => void
  children: ReactNode
}

export function BlockWrapper({ block, isSelected, hiddenOnCurrentWidth, onSelect, children, readOnlyPreview }: Props) {
  const anchorName = typeof block.props.anchorName === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(block.props.anchorName) ? block.props.anchorName : undefined
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const { duplicateBlock, removeBlock, moveBlock, shareSectionAcrossPages, unshareSection } = useConfigStore()
  const { selectedBlockId, selectBlock } = useEditorStore()
  const selectedSection = useEditorStore(state => state.selectedSection)
  const copiedSectionObject = useEditorStore(state => state.copiedSectionObject)
  const editorPreviewMode = useEditorStore((s) => s.previewMode)
  const previewMode = !!readOnlyPreview || editorPreviewMode
  const selectedSectionObject = useEditorStore((s) => s.selectedSectionObject)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; section?: number; objectX?: number; objectY?: number; item?: { field: string; index: number } } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ kind: 'move' | 'resize'; direction: string; x: number; y: number; width: number; left: number; top: number; height: number; pageWidth: number; minTop: number } | null>(null)
  const imageDragRef = useRef<{ index: string; x: number; y: number; left: number; top: number; originalStyle: string; element: HTMLImageElement } | null>(null)
  const [guides, setGuides] = useState<{ vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } }>({})
  function pasteSectionObject(section: number, x: number, y: number) {
    const state = useEditorStore.getState(), copied = state.copiedSectionObject
    if (!copied || copied.projectId !== state.activeProjectId) return
    const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
    if (!current || section < 1 || section > Math.max(1, Number(current.props.sectionCount) || 1)) return
    const key = `section${section}Objects`, items = Array.isArray(current.props[key]) ? current.props[key] as Record<string, unknown>[] : []
    const id = `object-${crypto.randomUUID()}`, width = Math.max(5, Math.min(100, Number(copied.item.width) || 30))
    const updates: Record<string, unknown> = { [key]: [...items, { ...structuredClone(copied.item), id, x: Math.max(0, Math.min(100 - width, x)), y: Math.max(0, y), layer: Math.max(0, ...items.map(item => Number(item?.layer) || 0)) + 1 }] }
    if (copied.text !== undefined) updates[`sectionObject_${id}`] = structuredClone(copied.text)
    if (copied.rich !== undefined) updates[`sectionObject_${id}Rich`] = structuredClone(copied.rich)
    useConfigStore.getState().updateBlockProps(block.id, updates)
    state.selectBlock(block.id); state.selectSection(section)
  }
  const revealRef = useRef<HTMLDivElement>(null)

  const imageLayout = block.type === 'image'
  const navbarLayout = block.type === 'navbar'
  const panelLayout = block.type === 'panel'
  const heroLayout = block.type === 'hero'
  const flexibleHeight = !imageLayout && !navbarLayout && !panelLayout && !heroLayout && block.type !== 'divider'
  const maximumHeight = flexibleHeight ? Infinity : 2000
  const resizableLayout = true
  const widthValue = Number(block.props.layoutWidth)
  const leftValue = Number(block.props.layoutLeft)
  const topValue = Number(block.props.layoutTop)
  const layerValue = Number(block.props.layoutLayer)
  const width = Number.isFinite(widthValue) && widthValue > 0 ? Math.max(5, Math.min(100, widthValue)) : 100
  const left = Number.isFinite(leftValue) ? Math.max(0, Math.min(100 - width, leftValue)) : 0
  const top = Number.isFinite(topValue) ? Math.max(-2000, Math.min(2000, topValue)) : 0
  const layer = Number.isFinite(layerValue) && layerValue > 0 ? Math.max(1, Math.min(100, Math.round(layerValue))) : 1
  const requestedHeight = Number(block.props.layoutHeight)
  const navbarHeight = navbarLayout && Number.isFinite(requestedHeight) && requestedHeight > 0 ? Math.max(40, Math.min(2000, requestedHeight)) : undefined
  const panelHeight = panelLayout && Number.isFinite(requestedHeight) && requestedHeight > 0 ? Math.max(40, Math.min(2000, requestedHeight)) : undefined
  const heroHeight = heroLayout && Number.isFinite(requestedHeight) && requestedHeight > 0 ? Math.max(40, Math.min(2000, requestedHeight)) : undefined
  const otherHeight = !imageLayout && !navbarLayout && !panelLayout && !heroLayout && Number.isFinite(requestedHeight) && requestedHeight > 0 ? Math.max(40, Math.min(maximumHeight, requestedHeight)) : undefined
  const layoutStyle = { position: 'relative' as const, width: `${width}%`, marginLeft: `${left}%`, marginTop: top, zIndex: layer, ...(navbarHeight ? { height: navbarHeight } : {}), ...(panelHeight || heroHeight || otherHeight ? { minHeight: panelHeight || heroHeight || otherHeight } : {}) }

  const index = blocks.findIndex((b) => b.id === block.id)
  const isFirst = index === 0
  const isLast = index === blocks.length - 1

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return
    const menu = menuRef.current
    menu.style.maxHeight = 'calc(100vh - 24px)'
    menu.style.overflowY = 'auto'
    const bounds = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(12, Math.min(contextMenu.x, window.innerWidth - bounds.width - 12))}px`
    menu.style.top = `${Math.max(12, Math.min(contextMenu.y, (window.innerHeight - bounds.height) / 2))}px`
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setContextMenu(null) }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setContextMenu(null); revealRef.current?.focus(); return }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      if (!buttons.length) return
      event.preventDefault()
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[(current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus()
    }
    const onResize = () => setContextMenu(null)
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize) }
  }, [contextMenu, revealRef])

  useEffect(() => {
    if (isSelected && revealRef.current) {
      revealRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected, revealRef])

  useLayoutEffect(() => {
    revealRef.current?.querySelectorAll('[data-ws-content] img:not([data-ws-gallery-expanded])').forEach((image, imageIndex) => {
      image.setAttribute('data-ws-image-index', String(imageIndex))
    })
    if (!previewMode) revealRef.current?.querySelectorAll<HTMLElement>('[data-ws-item-field][data-ws-item-index]').forEach(element => {
      const field = element.dataset.wsItemField ?? ''
      const index = Number(element.dataset.wsItemIndex)
      if (Array.isArray(block.props[field]) && Number.isInteger(index) && index >= 0 && index < (block.props[field] as unknown[]).length) { element.draggable = true; element.title = 'Drag to reorder; right-click for item actions' }
    })
    const counts: Record<string, number> = {}
    revealRef.current?.querySelectorAll('[data-ws-content] :is(h1,h2,h3,h4,h5,h6,p,span,a,li,label)').forEach(element => {
      const tag = element.tagName.toLowerCase()
      const ordinal = counts[tag] ?? 0
      counts[tag] = ordinal + 1
      element.setAttribute('data-ws-text-key', `${tag}-${ordinal}`)
    })
  }, [children, revealRef, block.props, previewMode])

  const scope = readOnlyPreview ? readOnlyPreview + '-' + encodeURIComponent(block.id).replace(/%/g, '_') : 'ws-' + index
  const blockSelector = `[data-ws-scope="${scope}"]`
  const selector = `${blockSelector} [data-ws-content]`
  const backgroundColor = typeof block.props.blockBackgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(block.props.blockBackgroundColor) ? block.props.blockBackgroundColor : ''
  const backgroundTarget = Number(block.props.sectionCount) > 1 ? `${selector}>:first-child>:first-child>:first-child` : `${selector}>:first-child`
  const textSize = Number(block.props.textSize)
  const textColor = typeof block.props.textColor === 'string' && /^#[0-9a-f]{6}$/i.test(block.props.textColor) ? block.props.textColor : ''
  const textRules = [
    Number.isFinite(textSize) && textSize >= 8 && textSize <= 200 ? `font-size:${textSize}px!important` : '',
    textColor ? `color:${textColor}!important` : '',
  ].filter(Boolean).join(';')
  const adjustments = block.props.imageAdjustments && typeof block.props.imageAdjustments === 'object' && !Array.isArray(block.props.imageAdjustments)
    ? block.props.imageAdjustments as Record<string, Record<string, unknown>> : {}
  const imageRules = Object.entries(adjustments).flatMap(([key, value]) => {
    if (!/^\d{1,4}$/.test(key) || !value || typeof value !== 'object' || Array.isArray(value)) return []
    const declarations = [
      value.width !== '' && Number.isFinite(Number(value.width)) && Number(value.width) > 0 ? `width:${Math.min(2000, Math.max(10, Number(value.width)))}px!important;max-width:none!important` : '',
      value.height !== '' && Number.isFinite(Number(value.height)) && Number(value.height) > 0 ? `height:${Math.min(2000, Math.max(10, Number(value.height)))}px!important` : '',
      value.left !== '' && Number.isFinite(Number(value.left)) ? `left:${Math.min(2000, Math.max(-2000, Number(value.left)))}px!important` : '',
      value.top !== '' && Number.isFinite(Number(value.top)) ? `top:${Math.min(2000, Math.max(-2000, Number(value.top)))}px!important` : '',
      value.layer !== '' && Number.isFinite(Number(value.layer)) ? `z-index:${Math.min(100, Math.max(1, Math.round(Number(value.layer))))}!important` : '',
    ].filter(Boolean).join(';')
    return declarations ? [`${selector} img[data-ws-image-index="${key}"]{position:relative!important;${declarations}}`, `${selector} :has(> img[data-ws-image-index="${key}"]){overflow:visible!important}`] : []
  }).join('')
  const textAdjustments = block.props.textAdjustments && typeof block.props.textAdjustments === 'object' && !Array.isArray(block.props.textAdjustments)
    ? block.props.textAdjustments as Record<string, Record<string, unknown>> : {}
  const individualTextRules = Object.entries(textAdjustments).flatMap(([key, value]) => {
    if (!/^(h[1-6]|p|span|a|li|label)-\d{1,4}$/.test(key) || !value || typeof value !== 'object' || Array.isArray(value)) return []
    const size = Number(value.size)
    const color = typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color) ? value.color : ''
    const font = typeof value.font === 'string' && /^[\p{L}\p{N} ,._-]{1,100}$/u.test(value.font) ? value.font : ''
    const declarations = [
      Number.isFinite(size) && size >= 6 && size <= 200 ? `font-size:${size}px!important` : '',
      color ? `color:${color}!important` : '',
      font ? `font-family:"${font}"!important` : '',
      typeof value.bold === 'boolean' ? `font-weight:${value.bold ? 'bold' : 'normal'}!important` : '',
      typeof value.italic === 'boolean' ? `font-style:${value.italic ? 'italic' : 'normal'}!important` : '',
      typeof value.underline === 'boolean' ? `text-decoration:${value.underline ? 'underline' : 'none'}!important` : '',
    ].filter(Boolean).join(';')
    return declarations ? [`${selector} [data-ws-text-key="${key}"]{${declarations}}`] : []
  }).join('')
  const heroHeightStyle = heroLayout ? `${selector}{min-height:var(--ws-hero-height,${heroHeight || 0}px)}${Number(block.props.sectionCount) > 1 ? `${selector}>:first-child,${selector}>:first-child>:first-child{min-height:var(--ws-hero-height,${heroHeight || 0}px)}` : ''}${backgroundTarget}{min-height:var(--ws-hero-height,${heroHeight || 0}px);box-sizing:border-box}${heroHeight ? `${selector} section{padding-block:8px!important}` : ''}[data-ws-scope="${scope}"][data-ws-hero-resizing] [data-ws-content] section{padding-block:8px!important}` : ''
  const buttonRules = ([['buttonBackgroundColor', 'background-color'], ['buttonTextColor', 'color'], ['buttonBorderColor', 'border-color']] as const).flatMap(([key, property]) => typeof block.props[key] === 'string' && /^#[0-9a-f]{6}$/i.test(block.props[key]) ? [`${property}:${block.props[key]}!important`, ...(key === 'buttonBorderColor' ? ['border-style:solid', 'border-width:1px'] : [])] : []).join(';')
  const customStyle = (backgroundColor ? `${blockSelector},${selector},${backgroundTarget}{background-color:${backgroundColor}!important}` : '') + (textRules ? `${selector} :is(h1,h2,h3,h4,h5,h6,p,span,a,li,label):not([data-rich-run]):not([data-ws-block-button]):not([data-ws-object-button]){${textRules}}` : '') + (buttonRules ? `${selector} [data-ws-block-button]{${buttonRules}}` : '') + individualTextRules + imageRules + heroHeightStyle + (otherHeight ? `${selector}{min-height:100%}` : '') + (navbarLayout ? `${selector},${selector}>[data-editor-section]{height:100%}${selector} nav{height:100%;box-sizing:border-box;padding-block:4px}` : '') + (panelLayout ? `@container (max-width:600px){${blockSelector}{width:100%!important;margin-left:0!important;margin-top:0!important;z-index:auto!important}}` : '')

  if (previewMode) {
    return (
      <div
        ref={revealRef}
        id={anchorName}
        className="scroll-revealed"
        style={layoutStyle}
        data-ws-scope={scope}
        data-ws-navbar-block={navbarLayout ? 'true' : undefined}
      >
        {customStyle && <style>{customStyle}</style>}
        <div data-ws-content><BlockColumns block={block}>{children}</BlockColumns></div>
        <PlacedMedia block={block} />
      </div>
    )
  }

  function startImageDrag(event: ReactPointerEvent<HTMLElement>, kind: 'move' | 'resize', direction = '') {
    if (event.button !== 0) return
    const element = revealRef.current
    if (!element?.parentElement) return
    const pageWidth = element.parentElement.getBoundingClientRect().width
    if (!pageWidth) return
    const image = element.querySelector('img')
    const height = (imageLayout ? image?.getBoundingClientRect().height : 0) || element.getBoundingClientRect().height
    const canvas = element.closest('[aria-label^="Site preview"]')
    const minTop = canvas ? top + canvas.getBoundingClientRect().top - element.getBoundingClientRect().top : -2000
    dragRef.current = { kind, direction, x: event.clientX, y: event.clientY, width, left, top, height, pageWidth, minTop: Math.max(-2000, minTop) }
    if (heroLayout && kind === 'resize') element.setAttribute('data-ws-hero-resizing', '')
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveImageDrag(event: ReactPointerEvent<HTMLElement>, finish = false) {
    const drag = dragRef.current
    const element = revealRef.current
    if (!drag || !element) return
    const dx = (event.clientX - drag.x) / drag.pageWidth * 100
    const dy = event.clientY - drag.y
    let nextLeft = drag.left
    let nextTop = drag.top
    let nextWidth = drag.width
    let nextHeight = drag.height
    if (drag.kind === 'move') {
      nextLeft = Math.max(0, Math.min(100 - drag.width, drag.left + dx))
      nextTop = Math.max(drag.minTop, Math.min(2000, drag.top + dy))
    } else {
      if (drag.direction.includes('e')) nextWidth = Math.max(5, Math.min(100 - drag.left, drag.width + dx))
      if (drag.direction.includes('w')) {
        nextLeft = Math.max(0, Math.min(drag.left + drag.width - 5, drag.left + dx))
        nextWidth = drag.width + drag.left - nextLeft
      }
      if (drag.direction.includes('s')) nextHeight = Math.max(40, Math.min(maximumHeight, drag.height + dy))
      if (drag.direction.includes('n')) {
        nextTop = Math.max(drag.minTop, Math.max(drag.top + drag.height - maximumHeight, Math.min(drag.top + drag.height - 40, drag.top + dy)))
        nextHeight = drag.height + drag.top - nextTop
      }
    }
    const spacingUpdates: Record<string, number> = {}
    let savedHeight = nextHeight
    if (flexibleHeight && drag.direction.includes('s')) {
      const sections = Array.from(element.querySelectorAll<HTMLElement>('[data-editor-section]'))
      if (dy < 0) {
        // Measure the content floor with the optional padding removed and grid stretch disabled.
        element.style.width = `${nextWidth}%`
        element.style.minHeight = '0'
        for (const section of sections) {
          section.style.alignSelf = 'start'
          section.style.setProperty('--ws-resize-extra-space', '0px')
        }
        const blockBounds = element.getBoundingClientRect()
        const rows = new Map<number, { section: HTMLElement; bottom: number }[]>()
        let contentHeight = blockBounds.height
        for (const section of sections) {
          const bounds = section.getBoundingClientRect()
          const bottom = Math.max(bounds.bottom, ...Array.from(section.querySelectorAll('[data-section-object]'), object => object.getBoundingClientRect().bottom))
          contentHeight = Math.max(contentHeight, bottom - blockBounds.top + 1)
          const row = rows.get(bounds.top) ?? []
          row.push({ section, bottom })
          rows.set(bounds.top, row)
        }
        nextHeight = Math.max(nextHeight, Math.ceil(contentHeight))
        // Shrinking trailing space should not raise the existing height floor on smaller screens.
        savedHeight = contentHeight <= blockBounds.height ? Math.min(nextHeight, otherHeight ?? nextHeight) : nextHeight
        let availableSpace = nextHeight - contentHeight
        for (const row of rows.values()) {
          const rowBottom = Math.max(...row.map(({ bottom }) => bottom))
          let rowGrowth = 0
          for (const { section, bottom } of row) {
            const key = `section${section.dataset.editorSection}ExtraSpace`
            const original = Math.max(0, Math.min(4000, Number(block.props[key]) || 0))
            const spacing = Math.min(original, Math.max(0, Math.floor(availableSpace + rowBottom - bottom)))
            if (spacing !== original) spacingUpdates[key] = spacing
            rowGrowth = Math.max(rowGrowth, spacing - (rowBottom - bottom))
            section.style.removeProperty('align-self')
            if (finish) section.style.removeProperty('--ws-resize-extra-space')
            else section.style.setProperty('--ws-resize-extra-space', `${spacing}px`)
          }
          availableSpace -= rowGrowth
        }
        element.style.minHeight = `${nextHeight}px`
      } else {
        for (const section of sections) section.style.removeProperty('--ws-resize-extra-space')
      }
    }
    if (finish) {
      dragRef.current = null
      if (heroLayout) { element.removeAttribute('data-ws-hero-resizing'); element.style.removeProperty('--ws-hero-height') }
      if (panelLayout) element.style.removeProperty('--ws-panel-height')
      if (block.type === 'divider') element.style.removeProperty('--ws-strip-height')
      useConfigStore.getState().updateBlockProps(block.id, drag.kind === 'move'
        ? { layoutLeft: Math.round(nextLeft), layoutTop: Math.round(nextTop) }
        : { layoutLeft: Math.round(nextLeft), layoutTop: Math.round(nextTop), layoutWidth: Math.round(nextWidth), layoutHeight: Math.round(savedHeight), ...spacingUpdates, ...(block.type === 'divider' ? { height: Math.round(savedHeight) } : {}) })
    } else if (drag.kind === 'move') {
      element.style.marginLeft = `${nextLeft}%`
      element.style.marginTop = `${nextTop}px`
    } else {
      element.style.marginLeft = `${nextLeft}%`
      element.style.marginTop = `${nextTop}px`
      element.style.width = `${nextWidth}%`
      if (navbarLayout) element.style.height = `${nextHeight}px`
      else if (!imageLayout) { element.style.minHeight = `${nextHeight}px`; if (heroLayout) element.style.setProperty('--ws-hero-height', `${nextHeight}px`); if (panelLayout) element.style.setProperty('--ws-panel-height', `${nextHeight}px`); if (block.type === 'divider') element.style.setProperty('--ws-strip-height', `${nextHeight}px`) }
      else {
        const image = element.querySelector('img')
        if (image) image.style.height = `${nextHeight}px`
      }
    }
  }

  return (
    <div
      ref={revealRef}
      id={anchorName}
      data-webstudio-block-id={block.id}
      data-ws-scope={scope}
      data-ws-navbar-block={navbarLayout ? 'true' : undefined}
      onDragStart={event => {
        if (event.target instanceof Element && event.target.closest('[data-webstudio-block-drag-handle]')) {
          event.dataTransfer.setData('application/x-webstudio-block', block.id)
          event.dataTransfer.effectAllowed = 'move'
          event.stopPropagation()
          onSelect()
          return
        }
        if (event.target instanceof Element) {
          const item = event.target.closest<HTMLElement>('[data-ws-item-field][data-ws-item-index]')
          if (item?.draggable && event.currentTarget.contains(item)) {
            event.dataTransfer.setData('application/x-webstudio-composite-item', JSON.stringify({ block: block.id, field: item.dataset.wsItemField, index: Number(item.dataset.wsItemIndex) }))
            event.dataTransfer.effectAllowed = 'move'; event.stopPropagation(); onSelect(); return
          }
        }
        if (block.type !== 'navbar' || !(event.target instanceof Element)) return
        const link = event.target.closest('[data-ws-nav-index]')
        if (!link || !event.currentTarget.contains(link)) return
        event.dataTransfer.setData('application/x-webstudio-navbar-link', link.getAttribute('data-ws-nav-index') ?? '')
        event.dataTransfer.effectAllowed = 'move'
        event.stopPropagation()
        onSelect()
      }}
      onDragOver={event => {
        if (event.dataTransfer.types.includes('application/x-webstudio-composite-item') && event.target instanceof Element && event.target.closest('[data-ws-item-field][data-ws-item-index]')) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; return }
        if (block.type !== 'navbar' || !event.dataTransfer.types.includes('application/x-webstudio-navbar-link')) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={event => {
        if (event.dataTransfer.types.includes('application/x-webstudio-composite-item') && event.target instanceof Element) {
          const target = event.target.closest<HTMLElement>('[data-ws-item-field][data-ws-item-index]')
          if (!target || !event.currentTarget.contains(target)) return
          event.preventDefault(); event.stopPropagation()
          try {
            const source = JSON.parse(event.dataTransfer.getData('application/x-webstudio-composite-item')) as { block: string; field: string; index: number }
            const to = Number(target.dataset.wsItemIndex), field = target.dataset.wsItemField ?? '', items = block.props[field]
            if (source.block !== block.id || source.field !== field || !Array.isArray(items) || !Number.isInteger(source.index) || source.index < 0 || source.index >= items.length || !Number.isInteger(to) || to < 0 || to >= items.length || source.index === to) return
            useConfigStore.getState().editBlockItems(block.id, field, source.index, to)
          } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be moved.') }
          return
        }
        if (block.type !== 'navbar' || !event.dataTransfer.types.includes('application/x-webstudio-navbar-link') || !(event.target instanceof Element)) return
        event.preventDefault()
        event.stopPropagation()
        const target = event.target.closest('[data-ws-nav-index]')
        if (!target || !event.currentTarget.contains(target)) return
        const rawItems = Array.isArray(block.props.navItems) ? block.props.navItems : []
        const legacy = Array.isArray(block.props.links) ? block.props.links : []
        if (!rawItems.every(item => item && typeof item === 'object' && typeof item.label === 'string' && typeof item.url === 'string') || !legacy.every(item => typeof item === 'string')) {
          toast.error('The Navbar contains invalid link data and cannot be reordered.')
          return
        }
        const items = [...rawItems, ...legacy.map(label => ({ label, url: '' }))]
        const from = Number(event.dataTransfer.getData('application/x-webstudio-navbar-link'))
        const to = Number(target.getAttribute('data-ws-nav-index'))
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return
        const [moved] = items.splice(from, 1)
        items.splice(to, 0, moved)
        useConfigStore.getState().updateBlockProps(block.id, { navItems: items, links: [] })
      }}
      onContextMenu={event => {
        if (event.target instanceof Element && event.target.closest('[data-ws-gallery-dialog]')) return
        event.preventDefault()
        event.stopPropagation()
        useEditorStore.getState().selectSectionObject(null)
        onSelect()
        const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ws-item-field][data-ws-item-index]') : null
        const field = element?.dataset.wsItemField ?? '', itemIndex = Number(element?.dataset.wsItemIndex), items = block.props[field]
        const item = element && Array.isArray(items) && Number.isInteger(itemIndex) && itemIndex >= 0 && itemIndex < items.length ? { field, index: itemIndex } : undefined
        useEditorStore.getState().selectCompositeItem(item ? { blockId: block.id, ...item } : null)
        const sectionElement = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-section]') : null
        const section = Number(sectionElement?.dataset.editorSection) || 1
        const bounds = sectionElement?.querySelector<HTMLElement>(`[data-section-object-area="${section}"]`)?.getBoundingClientRect()
        setContextMenu({ x: event.clientX, y: event.clientY, item, section, objectX: bounds?.width ? (event.clientX - bounds.left) / bounds.width * 100 : 0, objectY: bounds ? event.clientY - bounds.top : 0 })
      }}
      onPointerDown={event => {
        if (block.type === 'gallery' && (block.variant === 'responsive' || block.props.enablePhotoViewer === true) && event.target instanceof Element && event.target.closest('[data-ws-item-field="images"][draggable="true"], [data-ws-gallery-dialog]')) return
        if (!imageLayout && block.type !== 'collage' && event.button === 0 && event.target instanceof HTMLImageElement && event.target.closest('[data-ws-content]')) {
          const image = event.target
          const imageIndex = image.getAttribute('data-ws-image-index')
          if (imageIndex !== null) {
            const adjustment = adjustments[imageIndex] ?? {}
            imageDragRef.current = { index: imageIndex, x: event.clientX, y: event.clientY, left: Number(adjustment.left) || 0, top: Number(adjustment.top) || 0, originalStyle: image.style.cssText, element: image }
            onSelect(); useEditorStore.getState().selectImage(Number(imageIndex))
            event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
            return
          }
        }
        if (isSelected && ((imageLayout && event.target instanceof HTMLImageElement) || (panelLayout && event.target instanceof Element && !event.target.closest('button,a,input,textarea,select,[contenteditable="true"]')))) startImageDrag(event, 'move')
      }}
      onPointerMove={event => {
        const drag = imageDragRef.current
        if (drag) {
          drag.element.style.setProperty('position', 'relative', 'important')
          drag.element.style.setProperty('left', `${drag.left + event.clientX - drag.x}px`, 'important')
          drag.element.style.setProperty('top', `${drag.top + event.clientY - drag.y}px`, 'important')
          const current = drag.element.getBoundingClientRect()
          const matches: typeof guides = {}
          drag.element.closest('[aria-label^="Site preview"]')?.querySelectorAll<HTMLElement>('[data-section-object], [data-placed-media], [data-ws-image-index], [contenteditable="true"]').forEach(other => {
            if (other === drag.element || other.contains(drag.element) || drag.element.contains(other)) return
            const rect = other.getBoundingClientRect(); if (!rect.width || !rect.height) return
            if (!matches.vertical) for (const [a, b] of [[current.left, rect.left], [current.right, rect.right], [(current.left + current.right) / 2, (rect.left + rect.right) / 2]]) if (Math.abs(a - b) <= 4) { const top = Math.min(current.top, rect.top); matches.vertical = { x: b, top, height: Math.max(current.bottom, rect.bottom) - top }; break }
            if (!matches.horizontal) for (const [a, b] of [[current.top, rect.top], [current.bottom, rect.bottom], [(current.top + current.bottom) / 2, (rect.top + rect.bottom) / 2]]) if (Math.abs(a - b) <= 4) { const left = Math.min(current.left, rect.left); matches.horizontal = { y: b, left, width: Math.max(current.right, rect.right) - left }; break }
          })
          setGuides(matches)
          event.stopPropagation()
        } else moveImageDrag(event)
      }}
      onPointerUp={event => {
        setGuides({})
        const drag = imageDragRef.current
        if (drag) {
          imageDragRef.current = null
          const left = Math.max(-2000, Math.min(2000, Math.round(drag.left + event.clientX - drag.x)))
          const top = Math.max(-2000, Math.min(2000, Math.round(drag.top + event.clientY - drag.y)))
          drag.element.style.cssText = drag.originalStyle
          if (left !== drag.left || top !== drag.top) {
            const current = useConfigStore.getState().getActivePageBlocks().find(item => item.id === block.id)
            const existing = current?.props.imageAdjustments && typeof current.props.imageAdjustments === 'object' && !Array.isArray(current.props.imageAdjustments) ? current.props.imageAdjustments as Record<string, Record<string, unknown>> : {}
            useConfigStore.getState().updateBlockProps(block.id, { imageAdjustments: { ...existing, [drag.index]: { ...existing[drag.index], left, top } } })
          }
          event.stopPropagation()
        } else moveImageDrag(event, true)
      }}
      onPointerCancel={() => {
        setGuides({})
        if (imageDragRef.current) {
          const drag = imageDragRef.current; imageDragRef.current = null
          drag.element.style.cssText = drag.originalStyle
          return
        }
        if (!dragRef.current) return
        dragRef.current = null
        const element = revealRef.current
        if (element) {
          element.removeAttribute('data-ws-hero-resizing')
          element.style.removeProperty('--ws-hero-height')
          element.querySelectorAll<HTMLElement>('[data-editor-section]').forEach(section => section.style.removeProperty('--ws-resize-extra-space'))
          element.style.width = `${width}%`
          element.style.marginLeft = `${left}%`
          element.style.marginTop = `${top}px`
          if (navbarLayout) element.style.height = navbarHeight ? `${navbarHeight}px` : ''
          if (!navbarLayout && !imageLayout) element.style.minHeight = panelHeight || heroHeight || otherHeight ? `${panelHeight || heroHeight || otherHeight}px` : ''
          const image = element.querySelector('img')
          const height = Number(block.props.layoutHeight)
          if (imageLayout && image) image.style.height = Number.isFinite(height) && height > 0 ? `${Math.max(40, Math.min(2000, height))}px` : ''
        }
      }}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest('a')) e.preventDefault()
        onSelect()
        if (e.target instanceof HTMLImageElement && e.target.hasAttribute('data-ws-image-index')) {
          useEditorStore.getState().selectImage(Number(e.target.getAttribute('data-ws-image-index')))
        }
        if (e.target instanceof Element) {
          const item = e.target.closest<HTMLElement>('[data-ws-item-field][data-ws-item-index]')
          if (item && e.currentTarget.contains(item)) {
            const field = item.dataset.wsItemField ?? '', index = Number(item.dataset.wsItemIndex), items = block.props[field]
            if (Array.isArray(items) && Number.isInteger(index) && index >= 0 && index < items.length) useEditorStore.getState().selectCompositeItem({ blockId: block.id, field, index })
          }
          const textElement = e.target.closest('[data-ws-text-key]')
          if (textElement && e.currentTarget.contains(textElement)) useEditorStore.getState().selectText(textElement.getAttribute('data-ws-text-key') ?? '')
        }
        e.stopPropagation()
      }}
      className={`scroll-revealed relative cursor-pointer border-b border-border-subtle group ${
        block.type === 'divider' ? (isSelected ? 'outline outline-2 outline-[#1683e5] -outline-offset-1' : 'outline outline-1 outline-dashed outline-[#aab5c0] -outline-offset-1') : (resizableLayout || block.type === 'collage') ? (isSelected ? 'outline outline-1 outline-white -outline-offset-1' : '') : isSelected
          ? 'bg-green-glow2 outline outline-2 outline-green -outline-offset-2 rounded animate-select-pulse'
          : 'hover:bg-green-glow2'
      }`}
      role="button"
      aria-label={`${block.type} block${isSelected ? ', selected' : ''}`}
      aria-selected={isSelected}
      tabIndex={0}
      onPaste={e => {
        if (!(e.target instanceof Element) || e.target.closest('input,textarea,[contenteditable="true"]')) return
        const state = useEditorStore.getState(), copied = state.copiedSectionObject
        if (!copied || copied.projectId !== state.activeProjectId || e.clipboardData.getData('text/plain') !== `WebStudio object:${copied.token}`) return
        const target = e.target.closest<HTMLElement>('[data-editor-section]')
        pasteSectionObject(Number(target?.dataset.editorSection) || (isSelected ? selectedSection : 0) || 1, 0, 12)
        e.preventDefault(); e.stopPropagation()
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' && imageLayout && isSelected) {
          const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
          if (current) useConfigStore.getState().updateBlockProps(block.id, { section1ExtraSpace: Math.min(4000, Math.max(0, Number(current.props.section1ExtraSpace) || 0) + 32) })
          e.preventDefault(); e.stopPropagation()
          return
        }
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault()
          const bounds = e.currentTarget.getBoundingClientRect()
          onSelect()
          setContextMenu({ x: bounds.left + 10, y: bounds.top + 10 })
          return
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={layoutStyle}
    >
      {isSelected && <div role="button" tabIndex={0} draggable data-webstudio-block-drag-handle aria-label={`Move ${block.type} block`} title="Drag the top edge to reorder this block; Alt+Up or Alt+Down also moves it" className="absolute top-0 left-2 right-2 z-10 h-2 cursor-move" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
        event.preventDefault(); event.stopPropagation()
        const next = index + (event.key === 'ArrowUp' ? -1 : 1)
        if (next >= 0 && next < blocks.length) moveBlock(index, next)
      }} />}
      {/* Block type tag */}
      {block.type === 'divider' && <span aria-hidden="true" className="pointer-events-none absolute left-2 top-1 z-10 rounded bg-bg-2 px-1.5 py-0.5 text-[10px] font-normal text-text-1">Strip</span>}
      {hiddenOnCurrentWidth && <span className="absolute top-8 left-1.5 text-[10px] bg-bg-2 border border-border-default rounded px-1.5 py-0.5 z-10">Hidden at this width in preview and export</span>}
      {!resizableLayout && <span
        className={`absolute top-8 left-1.5 text-[9px] font-semibold uppercase tracking-wider text-green bg-green-glow px-1.5 py-0.5 rounded transition-opacity z-10 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <button type="button" role="menuitem" className="flex w-full rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => { setContextMenu(null); onSelect(); document.querySelector<HTMLButtonElement>('[aria-label="Expand right panel"]')?.click(); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-properties-tab]')?.click()) }}>Properties</button>
        {block.type}
      </span>}

      {contextMenu && createPortal(<div
        ref={menuRef} role="menu" aria-label={`${block.type} block actions`}
        className="fixed z-[10000] min-w-48 rounded border border-gray-400 bg-white p-1 text-sm text-black shadow-lg"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={event => event.stopPropagation()} onContextMenu={event => event.preventDefault()}
      >
        <button type="button" role="menuitem" className="flex w-full rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => { const item = contextMenu.item; setContextMenu(null); useEditorStore.getState().selectSectionObject(null); onSelect(); useEditorStore.getState().selectCompositeItem(item ? { blockId: block.id, ...item } : null); document.querySelector<HTMLButtonElement>('[aria-label="Expand right panel"]')?.click(); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-properties-tab]')?.click()) }}>Properties</button>
        <button type="button" role="menuitem" className="flex w-full rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => {
          const section = contextMenu.section || 1
          const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
          if (!current) return
          const key = `section${section}Objects`, items = Array.isArray(current.props[key]) ? current.props[key] as Record<string, unknown>[] : []
          const id = `object-${crypto.randomUUID()}`
          useConfigStore.getState().updateBlockProps(block.id, { [key]: [...items, { id, type: 'text', text: 'Text', textColor: '#000000', x: Math.max(0, Math.min(70, contextMenu.objectX || 0)), y: Math.max(0, contextMenu.objectY || 0), width: 30, height: 80, layer: Math.max(0, ...items.map(item => Number(item.layer) || 0)) + 1 }] })
          const editor = useEditorStore.getState(); editor.selectBlock(block.id); editor.selectSection(section); editor.setNewTextObjectId(id); setContextMenu(null)
        }}>Add text</button>
        <button type="button" role="menuitem" className="flex w-full rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => {
          const section = contextMenu.section || 1
          const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
          if (!current) return
          const key = `section${section}Objects`, items = Array.isArray(current.props[key]) ? current.props[key] as Record<string, unknown>[] : []
          const id = `object-${crypto.randomUUID()}`
          useConfigStore.getState().updateBlockProps(block.id, { [key]: [...items, { id, type: 'divider', x: Math.max(0, Math.min(50, contextMenu.objectX || 0)), y: Math.max(0, contextMenu.objectY || 0), width: 50, height: 24, layer: Math.max(0, ...items.map(item => Number(item.layer) || 0)) + 1 }] })
          const editor = useEditorStore.getState(); editor.selectBlock(block.id); editor.selectSection(section); editor.selectSectionObject({ blockId: block.id, section, id }); setContextMenu(null)
        }}>Add divider</button>
        {copiedSectionObject && copiedSectionObject.projectId === useEditorStore.getState().activeProjectId && <button type="button" role="menuitem" className="flex w-full rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => { if (contextMenu) pasteSectionObject(contextMenu.section || 1, contextMenu.objectX || 0, contextMenu.objectY || 0); setContextMenu(null) }}>Paste object</button>}
        {block.type === 'collage' && <button type="button" role="menuitem" className="flex w-full rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => { setContextMenu(null); const editor = useEditorStore.getState(); editor.setMovingCollage({ blockId: block.id, projectId: editor.activeProjectId, pageId: useConfigStore.getState().activePageId }); toast('Click the destination section. Press Escape to cancel.') }}>Move collage into a section…</button>}
        {contextMenu.item && <>
          <div className="px-3 pt-1 text-xs font-semibold">Item</div>
          {([-1, 1] as const).map(delta => <button key={delta} type="button" role="menuitem" disabled={contextMenu.item!.index + delta < 0 || contextMenu.item!.index + delta >= (block.props[contextMenu.item!.field] as unknown[]).length} className="flex w-full rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100 disabled:opacity-40" onClick={() => {
            const item = contextMenu.item!; setContextMenu(null)
            try { useConfigStore.getState().editBlockItems(block.id, item.field, item.index, item.index + delta) }
            catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be moved.') }
          }}>Move item {delta < 0 ? 'up' : 'down'}</button>)}
          <button type="button" role="menuitem" className="flex w-full rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => {
            const item = contextMenu.item!; setContextMenu(null)
            try { useConfigStore.getState().editBlockItems(block.id, item.field, item.index, item.index, 'duplicate') }
            catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be duplicated.') }
          }}>Duplicate item</button>
          <button type="button" role="menuitem" className="flex w-full rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => {
            const item = contextMenu.item!; setContextMenu(null)
            try { useConfigStore.getState().editBlockItems(block.id, item.field, item.index, item.index, 'remove') }
            catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be removed.') }
          }}>Remove item</button>
          <div className="mt-1 border-t border-gray-300 px-3 pt-1 text-xs font-semibold">Block</div>
        </>}
        <button type="button" role="menuitem" disabled={isFirst} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100 disabled:opacity-40" onClick={() => { setContextMenu(null); moveBlock(index, index - 1) }}><ChevronUp size={15} />Move up</button>
        <button type="button" role="menuitem" disabled={isLast} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100 disabled:opacity-40" onClick={() => { setContextMenu(null); moveBlock(index, index + 1) }}><ChevronDown size={15} />Move down</button>
        <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => { setContextMenu(null); duplicateBlock(block.id) }}><Copy size={15} />Duplicate</button>
        <div className="border-t border-gray-300 px-3 pt-2 text-xs font-semibold">Sections across</div>
        {[1, 2, 3, 4].map(count => <button key={count} type="button" role="menuitemradio" aria-checked={(Number(block.props.sectionCount) || 1) === count} className="flex w-full items-center rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => { useConfigStore.getState().updateBlockProps(block.id, { sectionCount: count }); setContextMenu(null) }}>
          {(Number(block.props.sectionCount) || 1) === count ? '✓ ' : '　'}{count} {count === 1 ? 'section' : 'sections'}
        </button>)}
        {(block.type === 'navbar' || block.type === 'footer') && <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => {
          setContextMenu(null)
          try {
            if (block.webstudioSharedSectionId) { unshareSection(block.id); toast('Sections are now independent on each page') }
            else { shareSectionAcrossPages(block.id); toast('Section shared across pages; edits update every copy') }
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Section could not be shared') }
        }}><Globe size={15} />{block.webstudioSharedSectionId ? 'Stop sharing across pages' : 'Share across pages'}</button>}
        <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => {
          setContextMenu(null)
          if (selectedBlockId === block.id) selectBlock(null)
          removeBlock(block.id)
          toast('Block removed', { action: { label: 'Undo', onClick: () => { useConfigStore.getState().undo(); toast('Block restored') } }, duration: 3000 })
        }}><Trash2 size={15} />Delete</button>
      </div>, document.body)}

      {customStyle && <style>{customStyle}</style>}
      {(guides.vertical || guides.horizontal) && createPortal(<div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
        {guides.vertical && <div style={{ position: 'fixed', left: guides.vertical.x, top: guides.vertical.top, height: guides.vertical.height, width: 1, background: '#1683e5' }} />}
        {guides.horizontal && <div style={{ position: 'fixed', left: guides.horizontal.left, top: guides.horizontal.y, width: guides.horizontal.width, height: 1, background: '#1683e5' }} />}
      </div>, document.body)}
      <div data-ws-content><BlockColumns block={block} editable selectedSection={isSelected ? selectedSection : 0} onSelectSection={section => { selectBlock(block.id); useEditorStore.getState().selectSection(section) }}>{children}</BlockColumns></div>
      <PlacedMedia block={block} editable />
      {resizableLayout && isSelected && !selectedSectionObject && ([
        ['nw', 'top-0 left-0 cursor-nwse-resize'], ['n', 'top-0 left-1/2 -translate-x-1/2 cursor-ns-resize'],
        ['ne', 'top-0 right-0 cursor-nesw-resize'], ['e', 'top-1/2 right-0 -translate-y-1/2 cursor-ew-resize'],
        ['se', 'bottom-0 right-0 cursor-nwse-resize'], ['s', 'bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize'],
        ['sw', 'bottom-0 left-0 cursor-nesw-resize'], ['w', 'top-1/2 left-0 -translate-y-1/2 cursor-ew-resize'],
      ] as const).map(([direction, position]) => <button
        key={direction} type="button" aria-label={`Resize ${block.type} ${direction}`} title={`Drag to resize ${block.type}`}
        className={`absolute z-20 h-3 w-3 border border-black bg-white touch-none ${position}`}
        onClick={event => event.stopPropagation()}
        onPointerDown={event => startImageDrag(event, 'resize', direction)}
        onPointerMove={event => { event.stopPropagation(); moveImageDrag(event) }}
        onPointerUp={event => { event.stopPropagation(); moveImageDrag(event, true) }}
      />)}
    </div>
  )
}
