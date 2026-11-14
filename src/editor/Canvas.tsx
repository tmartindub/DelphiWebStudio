import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { CanvasEmpty } from './CanvasEmpty'
import { BlockWrapper } from '@/blocks/BlockWrapper'
import { RenderBlock } from '@/blocks/registry'
import { resolveTheme, themeToCSS } from '@/lib/theme-presets'
import { useProjectsStore } from '@/store/projectsStore'
import { ProjectMediaLibrary, type MediaAsset } from '@/media/media-library'
import { toast } from 'sonner'
import { blockMetadata } from '@/lib/block-metadata'

function scrollToPreviewAnchor(canvas: HTMLElement, anchor: string) {
  const destination = Array.from(canvas.querySelectorAll<HTMLElement>('[id]')).find(element => element.id === anchor)
  if (destination) destination.scrollIntoView({ behavior: 'smooth', block: 'start' })
  else toast('That anchor was not found on this page.')
}

export function Canvas() {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const theme = useConfigStore((s) => s.config.theme)
  const pages = useConfigStore((s) => s.config.pages)
  const activePageId = useConfigStore((s) => s.activePageId)
  const activeArticle = pages?.find(page => page.id === activePageId)?.webstudioArticle
  const setActivePage = useConfigStore((s) => s.setActivePage)
  const { selectedBlockId, selectBlock, viewport, customViewportWidth, activeProjectId, previewMode } = useEditorStore()
  const textPlacement = useEditorStore(state => state.textPlacement)
  const mediaPlacement = useEditorStore(state => state.mediaPlacement)
  const movingCollage = useEditorStore(state => state.movingCollage)
  const revision = useProjectsStore(state => state.projects.find(project => project.id === activeProjectId)?.mediaRevision ?? 0)
  const webmasterEmail = useProjectsStore(state => state.projects.find(project => project.id === activeProjectId)?.settings?.webmasterEmail ?? '')
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const marqueeStart = useRef<{ x: number; y: number; blockId: string; section: number } | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; endX: number; endY: number } | null>(null)
  const groupDrag = useRef<{ x: number; y: number; members: Array<{ node: HTMLElement; blockId: string; section: number; id: string; x: number; y: number; width: number; areaWidth: number }> } | null>(null)
  const suppressCanvasClick = useRef(false)
  const canvasScroll = useRef<HTMLDivElement>(null)
  const previewCanvas = useRef<HTMLDivElement>(null)
  const previousPage = useRef(activePageId)
  const pendingAnchor = useRef<{ pageId: string; name: string } | null>(null)
  const referencedAssets = JSON.stringify([...new Set([
    ...blocks.map(block => typeof block.props.assetId === 'string' ? block.props.assetId : '').filter(Boolean),
    ...(JSON.stringify(blocks).match(/assets\/[a-zA-Z0-9._-]+/g) ?? []),
  ])].sort())

  useEffect(() => {
    if (!activeProjectId) return
    let active = true
    const urls: string[] = []
    new ProjectMediaLibrary().list(activeProjectId).then(assets => {
      if (!active) return
      const mapped: Record<string, string> = {}
      const referenced = new Set<string>(JSON.parse(referencedAssets))
      for (const asset of assets) if (referenced.has(asset.id) || referenced.has(asset.path)) {
        const url = URL.createObjectURL(asset.content)
        mapped[asset.id] = url
        mapped[asset.path] = url
        urls.push(url)
      }
      setAssetUrls(mapped)
    }).catch(() => { if (active) setAssetUrls({}) })
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [activeProjectId, revision, referencedAssets])

  const resolved = useMemo(() => resolveTheme(theme), [theme])
  const cssVars = useMemo(() => themeToCSS(resolved), [resolved])

  const previewWidth = customViewportWidth ?? (viewport === 'desktop' ? 1200 : viewport === 'tablet' ? 768 : 375)

  useLayoutEffect(() => {
    const pageChanged = previousPage.current !== activePageId
    previousPage.current = activePageId
    const destination = pendingAnchor.current
    pendingAnchor.current = null
    if (!previewMode) return
    if (destination?.pageId === activePageId && previewCanvas.current) {
      scrollToPreviewAnchor(previewCanvas.current, destination.name)
    } else if (pageChanged) {
      canvasScroll.current?.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [activePageId, previewMode])

  useEffect(() => {
    if (!textPlacement && !movingCollage && !mediaPlacement) return
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') { useEditorStore.getState().setTextPlacement(null); useEditorStore.getState().setMediaPlacement(null); useEditorStore.getState().setMovingCollage(null) } }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [textPlacement, movingCollage, mediaPlacement])

  const canvasContent = (
    <div
      ref={previewCanvas}
      className={`@container outline outline-1 rounded-xl ${blocks.length === 0 ? 'min-h-[400px]' : ''} relative z-[1] overflow-clip transition-all duration-300 mx-auto shrink-0`}
      style={{ width: `${previewWidth}px`, ...cssVars, color: 'var(--color-text-0)', backgroundColor: 'var(--color-bg-0)', outlineColor: 'var(--color-border-default)', overflowWrap: 'anywhere' } as React.CSSProperties}
      onPointerDownCapture={event => {
        // React portals bubble through the canvas even though their menus are outside it.
        if (previewMode || !(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return
        if (mediaPlacement && event.button === 0) {
          event.preventDefault(); event.stopPropagation()
          const editor = useEditorStore.getState()
          editor.setMediaPlacement(null)
          if (mediaPlacement.projectId !== editor.activeProjectId || mediaPlacement.pageId !== useConfigStore.getState().activePageId) { toast.error('The page changed. Select the image again.'); return }
          const section = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-section]') : null
          const number = Number(section?.dataset.editorSection)
          const blockId = section?.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id')
          const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === blockId)
          const area = section?.querySelector<HTMLElement>(`[data-section-object-area="${number}"]`)
          if (block?.type === 'gallery' && (!section || number === 1) && !(event.target instanceof Element && event.target.closest('[data-ws-object-type="panel"],[data-ws-parented="true"]'))) {
            const index = useConfigStore.getState().addGalleryImages(block.id, [{ src: mediaPlacement.path, assetId: mediaPlacement.id, alt: mediaPlacement.name, caption: '' }])
            selectBlock(block.id); editor.selectCompositeItem({ blockId: block.id, field: 'images', index })
            return
          }
          if (block && area && number >= 1 && number <= 4) {
            const bounds = area.getBoundingClientRect(), key = `section${number}Objects`
            const items = Array.isArray(block.props[key]) ? block.props[key] as Array<Record<string, unknown>> : []
            const id = `object-${crypto.randomUUID()}`, width = 30
            const parentId = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-section-object]')?.dataset.sectionObject : undefined
            const parent = items.find(item => item.id === parentId && item.type === 'panel')
            useConfigStore.getState().updateBlockProps(block.id, { [key]: [...items, { id, type: 'image', src: mediaPlacement.path, assetId: mediaPlacement.id, alt: mediaPlacement.name, x: Math.max(0, Math.min(70, (event.clientX - bounds.left) / Math.max(1, bounds.width) * 100)), y: Math.max(0, event.clientY - bounds.top), width, height: mediaPlacement.width && mediaPlacement.height ? Math.max(24, bounds.width * .3 * mediaPlacement.height / mediaPlacement.width) : 180, layer: Math.max(0, ...items.map(item => Number(item.layer) || 0)) + 1, ...(parent ? { parentId: parent.id } : {}) }] })
            selectBlock(block.id); editor.selectSection(number); editor.selectSectionObject({ blockId: block.id, section: number, id })
          } else {
            const id = `block-${crypto.randomUUID()}`
            useConfigStore.getState().addBlock({ id, type: 'image', variant: 'hero-image', props: { assetId: mediaPlacement.id, src: mediaPlacement.path, alt: mediaPlacement.name, layoutWidth: 40 } })
            selectBlock(id)
          }
          return
        }
        if (event.button === 0 && event.target instanceof Element && !event.target.closest('button,[contenteditable="true"]')) {
          const object = event.target.closest<HTMLElement>('[data-section-object]')
          const blockId = object?.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id')
          const section = Number(object?.closest<HTMLElement>('[data-editor-section]')?.dataset.editorSection)
          const id = object?.dataset.sectionObject
          if (blockId && id && section >= 1 && section <= 4) {
            const editor = useEditorStore.getState()
            if (event.shiftKey) {
              if (!editor.selectedSectionObjects.length) selectBlock(blockId)
              editor.toggleSectionObject({ blockId, section, id }); object.focus({ preventScroll: true }); event.preventDefault(); event.stopPropagation(); return
            }
            if (editor.selectedSectionObjects.length > 1 && editor.selectedSectionObjects.some(item => item.blockId === blockId && item.section === section && item.id === id)) {
              const selection = editor.selectedSectionObjects
              const members: NonNullable<typeof groupDrag.current>['members'] = []
              for (const block of useConfigStore.getState().getActivePageBlocks()) for (const number of [1, 2, 3, 4]) {
                const values = block.props[`section${number}Objects`]
                if (!Array.isArray(values)) continue
                const ids = new Set(selection.filter(value => value.blockId === block.id && value.section === number).map(value => value.id))
                for (const value of values as Array<{ id: string; parentId?: string; x: number; y: number; width: number }>) {
                  if (!ids.has(value.id) && !(value.parentId && ids.has(value.parentId))) continue
                  const node = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-section-object]')).find(element => element.dataset.sectionObject === value.id && element.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id') === block.id && Number(element.closest<HTMLElement>('[data-editor-section]')?.dataset.editorSection) === number)
                  const areaWidth = node?.closest<HTMLElement>('[data-section-object-area]')?.clientWidth ?? 0
                  if (node && areaWidth) members.push({ node, blockId: block.id, section: number, id: value.id, x: Number(value.x) || 0, y: Number(value.y) || 0, width: Number(value.width) || 30, areaWidth })
                }
              }
              if (members.length >= selection.length) { groupDrag.current = { x: event.clientX, y: event.clientY, members }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation(); return }
            }
          }
        }
        if (event.shiftKey && event.button === 0 && !textPlacement && !movingCollage && event.target instanceof Element && !event.target.closest('[data-section-object], [contenteditable], button, a, input')) {
          const sectionElement = event.target.closest<HTMLElement>('[data-editor-section]')
          const section = Number(sectionElement?.dataset.editorSection)
          const blockId = sectionElement?.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id')
          if (blockId && section >= 1 && section <= 4) {
            marqueeStart.current = { x: event.clientX, y: event.clientY, blockId, section }
            setMarquee({ x: event.clientX, y: event.clientY, endX: event.clientX, endY: event.clientY })
            event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation(); return
          }
        }
        if (event.altKey && event.button === 0) {
          const layers = Array.from(new Set(document.elementsFromPoint(event.clientX, event.clientY).map(element => element.closest<HTMLElement>('[data-section-object], [data-placed-media], [data-ws-item-field][data-ws-item-index]')).filter((element): element is HTMLElement => !!element && event.currentTarget.contains(element))))
          if (layers.length > 1) {
            const editor = useEditorStore.getState(), current = editor.selectedSectionObject, media = editor.selectedPlacedMedia, composite = editor.selectedCompositeItem
            const index = layers.findIndex(element => { const blockId = element.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id'); return (element.dataset.sectionObject === current?.id && blockId === current?.blockId) || (element.dataset.placedMedia === media?.id && blockId === media?.blockId) || (element.dataset.wsItemField === composite?.field && Number(element.dataset.wsItemIndex) === composite?.index && blockId === composite?.blockId) })
            const target = layers[(index + 1) % layers.length]
            const id = target.dataset.sectionObject, mediaId = target.dataset.placedMedia, field = target.dataset.wsItemField, itemIndex = Number(target.dataset.wsItemIndex), blockId = target.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id'), section = Number(target.closest<HTMLElement>('[data-editor-section]')?.dataset.editorSection)
            if (blockId && ((id && section >= 1 && section <= 4) || mediaId || (field && Number.isInteger(itemIndex) && itemIndex >= 0))) {
              selectBlock(blockId)
              if (id) { editor.selectSection(section); editor.selectSectionObject({ blockId, section, id }) }
              else if (mediaId) editor.selectPlacedMedia({ blockId, id: mediaId })
              else if (field) editor.selectCompositeItem({ blockId, field, index: itemIndex })
              target.focus({ preventScroll: true }); event.preventDefault(); event.stopPropagation(); return
            }
          }
        }
        if (event.target instanceof Element && !event.target.closest('[data-section-object]')) useEditorStore.getState().selectSectionObject(null)
        if (event.target instanceof Element && !event.target.closest('[data-ws-item-field]')) useEditorStore.getState().selectCompositeItem(null)
        if (event.target instanceof Element && !event.target.closest('[data-placed-media]')) useEditorStore.getState().selectPlacedMedia(null)
        if (movingCollage && event.button === 0) {
          event.preventDefault(); event.stopPropagation()
          const editor = useEditorStore.getState()
          if (movingCollage.projectId !== editor.activeProjectId || movingCollage.pageId !== useConfigStore.getState().activePageId) { editor.setMovingCollage(null); toast.error('The page changed. Select the collage again.'); return }
          const section = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-section]') : null
          const number = Number(section?.dataset.editorSection)
          const targetId = section?.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id')
          const area = section?.querySelector<HTMLElement>(`[data-section-object-area="${number}"]`)
          if (!targetId || !area || targetId === movingCollage.blockId) { toast('Click a different section to move the collage.'); return }
          const bounds = area.getBoundingClientRect()
          try {
            useConfigStore.getState().moveCollageBlockToSection(movingCollage.blockId, targetId, number, bounds.width ? (event.clientX - bounds.left) / bounds.width * 100 : 0, event.clientY - bounds.top)
            editor.setMovingCollage(null); selectBlock(targetId); editor.selectSection(number); toast('Collage moved into section')
          } catch (error) { editor.setMovingCollage(null); toast.error(error instanceof Error ? error.message : 'The collage could not be moved.') }
          return
        }
        if (!textPlacement || event.button !== 0) return
        event.preventDefault(); event.stopPropagation()
        useEditorStore.getState().setTextPlacement(null)
        const isPanel = textPlacement.kind === 'panel'
        const isLine = textPlacement.kind === 'divider'
        if (textPlacement.projectId !== useEditorStore.getState().activeProjectId || textPlacement.pageId !== useConfigStore.getState().activePageId) { toast.error(`The page changed. Select Add ${isLine ? 'line' : isPanel ? 'panel' : 'text'} again.`); return }
        const section = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-section]') : null
        const sectionNumber = Number(section?.dataset.editorSection)
        const blockId = section?.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id')
        const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === blockId)
        const area = section?.querySelector<HTMLElement>(`[data-section-object-area="${sectionNumber}"]`)
        if (!block || !area || sectionNumber < 1 || sectionNumber > 4) {
          const meta = blockMetadata.find(item => item.type === 'content')
          if (!meta) return
          const id = `object-${crypto.randomUUID()}`
          const newBlockId = `block-${crypto.randomUUID()}`
          const bounds = event.currentTarget.getBoundingClientRect()
          const x = bounds.width ? Math.max(0, Math.min(70, (event.clientX - bounds.left) / bounds.width * 100)) : 0
          useConfigStore.getState().addBlock({ id: newBlockId, type: 'content', variant: meta.variants[0], props: { ...structuredClone(meta.defaultProps), title: '', body: '', section1Objects: [{ id, type: isLine ? 'divider' : isPanel ? 'panel' : 'text', text: isPanel ? 'Panel' : isLine ? '' : textPlacement.text || 'Text', color: isPanel ? '#b9aeb6' : '', textColor: '#000000', fontSize: textPlacement.fontSize || '', x, y: 0, width: isLine && textPlacement.lineOrientation === 'vertical' ? 5 : 30, height: isLine ? (textPlacement.lineOrientation === 'vertical' ? 140 : 24) : isPanel ? 160 : 80, layer: 1, ...(isLine ? { lineOrientation: textPlacement.lineOrientation, lineStyle: textPlacement.lineStyle, lineThickness: textPlacement.lineThickness } : {}) }] } })
          selectBlock(newBlockId)
          useEditorStore.getState().selectSection(1)
          if (isPanel || isLine) useEditorStore.getState().selectSectionObject({ blockId: newBlockId, section: 1, id })
          else useEditorStore.getState().setNewTextObjectId(id)
          return
        }
        const bounds = area.getBoundingClientRect()
        if (!bounds.width) return
        const key = `section${sectionNumber}Objects`
        const items = Array.isArray(block.props[key]) ? block.props[key] as Array<Record<string, unknown>> : []
        const hitId = event.target instanceof Element ? event.target.closest('[data-section-object]')?.getAttribute('data-section-object') : null
        const parent = items.find(item => item.id === hitId && item.type === 'panel') ?? [...items].filter(item => item.type === 'panel' && typeof item.id === 'string').sort((a, b) => (Number(b.layer) || 0) - (Number(a.layer) || 0)).find(item => {
          const bounds = area.querySelector<HTMLElement>(`[data-section-object="${item.id}"]`)?.getBoundingClientRect()
          return bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
        })
        const id = `object-${crypto.randomUUID()}`
        const x = Math.max(0, Math.min(70, (event.clientX - bounds.left) / bounds.width * 100))
        const y = Math.max(0, event.clientY - bounds.top)
        const layer = Math.max(0, ...items.map(item => Number(item.layer) || 0)) + 1
        useConfigStore.getState().updateBlockProps(block.id, { [key]: [...items, { id, type: isLine ? 'divider' : isPanel ? 'panel' : 'text', text: isPanel ? 'Panel' : isLine ? '' : textPlacement.text || 'Text', color: isPanel ? '#b9aeb6' : '', textColor: '#000000', fontSize: textPlacement.fontSize || '', x, y, width: isLine && textPlacement.lineOrientation === 'vertical' ? 5 : 30, height: isLine ? (textPlacement.lineOrientation === 'vertical' ? 140 : 24) : isPanel ? 160 : 80, layer, ...(!isPanel && parent ? { parentId: parent.id } : {}), ...(isLine ? { lineOrientation: textPlacement.lineOrientation, lineStyle: textPlacement.lineStyle, lineThickness: textPlacement.lineThickness } : {}) }] })
        selectBlock(block.id)
        useEditorStore.getState().selectSection(sectionNumber)
        if (isPanel || isLine) useEditorStore.getState().selectSectionObject({ blockId: block.id, section: sectionNumber, id })
        else useEditorStore.getState().setNewTextObjectId(id)
      }}
      onPointerMove={event => {
        const group = groupDrag.current
        if (group) {
          const dx = Math.max(Math.max(...group.members.map(item => -item.x * item.areaWidth / 100)), Math.min(Math.min(...group.members.map(item => (100 - item.width - item.x) * item.areaWidth / 100)), event.clientX - group.x))
          const dy = Math.max(Math.max(...group.members.map(item => -item.y)), event.clientY - group.y)
          group.members.forEach(item => { item.node.style.left = `${item.x + dx / item.areaWidth * 100}%`; item.node.style.top = `${item.y + dy}px` }); event.stopPropagation(); return
        }
        if (marqueeStart.current) { setMarquee({ x: marqueeStart.current.x, y: marqueeStart.current.y, endX: event.clientX, endY: event.clientY }); event.stopPropagation() }
      }}
      onPointerUp={event => {
        const group = groupDrag.current
        if (group) {
          groupDrag.current = null; suppressCanvasClick.current = true; event.preventDefault(); event.stopPropagation()
          const dx = Math.max(Math.max(...group.members.map(item => -item.x * item.areaWidth / 100)), Math.min(Math.min(...group.members.map(item => (100 - item.width - item.x) * item.areaWidth / 100)), event.clientX - group.x))
          const dy = Math.max(Math.max(...group.members.map(item => -item.y)), event.clientY - group.y)
          if (Math.hypot(dx, dy) < 1) return
          const updates: Array<{ id: string; props: Record<string, unknown> }> = []
          for (const blockId of new Set(group.members.map(item => item.blockId))) {
            const block = useConfigStore.getState().getActivePageBlocks().find(value => value.id === blockId)
            if (!block) continue
            const changes: Record<string, unknown> = {}
            for (const section of new Set(group.members.filter(item => item.blockId === blockId).map(item => item.section))) {
              const key = `section${section}Objects`, values = block.props[key]
              if (Array.isArray(values)) changes[key] = values.map((value: { id: string }) => { const member = group.members.find(item => item.blockId === blockId && item.section === section && item.id === value.id); return member ? { ...value, x: member.x + dx / member.areaWidth * 100, y: member.y + dy } : value })
            }
            updates.push({ id: blockId, props: changes })
          }
          if (updates.length) useConfigStore.getState().updateMultipleBlockProps(updates)
          return
        }
        const start = marqueeStart.current
        if (!start) return
        marqueeStart.current = null; setMarquee(null); suppressCanvasClick.current = true; event.preventDefault(); event.stopPropagation()
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) return
        const left = Math.min(start.x, event.clientX), right = Math.max(start.x, event.clientX), top = Math.min(start.y, event.clientY), bottom = Math.max(start.y, event.clientY)
        const selected = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-section-object]')).filter(element => {
          const bounds = element.getBoundingClientRect()
          return bounds.right >= left && bounds.left <= right && bounds.bottom >= top && bounds.top <= bottom
        }).map(element => ({ blockId: element.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id') ?? '', section: Number(element.closest<HTMLElement>('[data-editor-section]')?.dataset.editorSection), id: element.dataset.sectionObject || '' })).filter(item => item.id && item.blockId && item.section >= 1 && item.section <= 4)
        selectBlock(start.blockId); const editor = useEditorStore.getState(); editor.selectSection(start.section); editor.setSectionObjects(selected)
      }}
      onPointerCancel={() => { groupDrag.current?.members.forEach(item => { item.node.style.left = `${item.x}%`; item.node.style.top = `${item.y}px` }); groupDrag.current = null; marqueeStart.current = null; setMarquee(null) }}
      onKeyDownCapture={event => {
        const editor = useEditorStore.getState(), selection = editor.selectedSectionObjects
        if (previewMode || selection.length < 2 || !(event.target instanceof Element) || event.target.closest('[contenteditable="true"], input, textarea, select')) return
        if (event.key !== 'Delete' && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        const groups = selection.map(({ blockId, section }) => `${blockId}\u0000${section}`).filter((value, index, values) => values.indexOf(value) === index).flatMap(value => {
          const [blockId, number] = value.split('\u0000'), section = Number(number)
          const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === blockId), key = `section${section}Objects`
          const items = Array.isArray(block?.props[key]) ? block.props[key] as Array<{ id: string; parentId?: string; x: number; y: number; width: number }> : []
          const ids = new Set(selection.filter(item => item.blockId === blockId && item.section === section).map(item => item.id))
          const width = event.currentTarget.querySelector<HTMLElement>(`[data-webstudio-block-id="${CSS.escape(blockId)}"] [data-section-object-area="${section}"]`)?.clientWidth ?? 0
          return block && items.length && width ? [{ blockId, key, items, ids, width, members: items.filter(item => ids.has(item.id) || (item.parentId && ids.has(item.parentId))) }] : []
        })
        if (!groups.length) return
        event.preventDefault(); event.stopPropagation()
        const step = event.shiftKey ? 10 : 1
        const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0
        const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0
        const members = groups.flatMap(group => group.members.map(item => ({ ...item, x: Number(item.x) || 0, y: Number(item.y) || 0, width: Number(item.width) || 30, areaWidth: group.width })))
        const safeX = Math.max(Math.max(...members.map(item => -item.x * item.areaWidth / 100)), Math.min(Math.min(...members.map(item => (100 - item.width - item.x) * item.areaWidth / 100)), dx))
        const safeY = Math.max(Math.max(...members.map(item => -item.y)), dy)
        const updates: Array<{ id: string; props: Record<string, unknown> }> = []
        for (const blockId of new Set(groups.map(group => group.blockId))) {
          const changes: Record<string, unknown> = {}
          for (const group of groups.filter(value => value.blockId === blockId)) changes[group.key] = event.key === 'Delete' ? group.items.filter(item => !group.ids.has(item.id)).map(item => item.parentId && group.ids.has(item.parentId) ? { ...item, parentId: undefined } : item) : group.items.map(item => group.members.includes(item) ? { ...item, x: (Number(item.x) || 0) + safeX / group.width * 100, y: (Number(item.y) || 0) + safeY } : item)
          updates.push({ id: blockId, props: changes })
        }
        if (updates.length) useConfigStore.getState().updateMultipleBlockProps(updates)
        if (event.key === 'Delete') editor.setSectionObjects([])
      }}
      onClickCapture={event => {
        if (previewMode) {
          suppressCanvasClick.current = false
          return
        }
        if (suppressCanvasClick.current || (event.shiftKey && event.target instanceof Element && event.target.closest('[data-section-object]'))) {
          suppressCanvasClick.current = false
          event.stopPropagation()
          event.preventDefault()
        }
      }}
      onClick={(e) => {
        if (previewMode && !e.defaultPrevented && e.target instanceof Element) {
          const link = e.target.closest('a[href]')
          if (link) {
            const href = link.getAttribute('href') ?? ''
            if (link.hasAttribute('download') && href.startsWith('blob:')) return
            e.preventDefault()
            link.closest<HTMLElement>('[data-ws-navbar-submenu]')?.hidePopover?.()
            if (href.startsWith('#')) {
              scrollToPreviewAnchor(e.currentTarget, href.slice(1))
              return
            }
            const path = href.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
            const target = pages?.find(page => page.path === path && page.webstudioArticle?.status !== 'draft')
            if (target && href.startsWith('/')) {
              const fragmentStart = href.indexOf('#')
              if (fragmentStart >= 0 && fragmentStart < href.length - 1) {
                const name = href.slice(fragmentStart + 1)
                if (target.id === activePageId) scrollToPreviewAnchor(e.currentTarget, name)
                else pendingAnchor.current = { pageId: target.id, name }
              } else if (target.id === activePageId) {
                canvasScroll.current?.scrollTo({ top: 0, behavior: 'instant' })
              }
              setActivePage(target.id)
              selectBlock(null)
            }
            else toast('Open the exported website to follow this link.')
            return
          }
        }
        if (e.target === e.currentTarget) selectBlock(null)
      }}
      role="region"
      aria-label={`Site preview, ${blocks.length} blocks, ${viewport} viewport`}
    >
      {marquee && <div aria-hidden="true" style={{ position: 'fixed', left: Math.min(marquee.x, marquee.endX), top: Math.min(marquee.y, marquee.endY), width: Math.abs(marquee.endX - marquee.x), height: Math.abs(marquee.endY - marquee.y), border: '1px solid #0078d4', background: 'rgba(0,120,212,.12)', pointerEvents: 'none', zIndex: 10000 }} />}
      {(textPlacement || movingCollage || mediaPlacement) && <div className="absolute left-0 top-0 z-50 bg-blue-700 px-3 py-2 text-sm text-white" style={{ pointerEvents: 'none' }}>{mediaPlacement ? 'Click inside a section or panel to place the image.' : movingCollage ? 'Click the destination section for the collage.' : textPlacement?.kind === 'divider' ? 'Click inside a section to place the line.' : textPlacement?.kind === 'panel' ? 'Click inside a section to place the panel.' : 'Click inside a section or on a panel to place text.'} Press Esc to cancel.</div>}
      {!previewMode && viewport === 'desktop' && <div aria-hidden="true" className="absolute inset-y-0 left-1/2 z-30 pointer-events-none" style={{ width: 'min(1100px, calc(100% - 32px))', transform: 'translateX(-50%)', borderLeft: '1px dashed #8996a2', borderRight: '1px dashed #8996a2' }} />}
      {activeArticle && (activeArticle.author || activeArticle.summary || activeArticle.tags?.length) && <header className="px-6 py-3 text-text-1">
        {activeArticle.author && <p className="text-sm">By {activeArticle.author}</p>}
        {activeArticle.summary && <p className="text-sm">{activeArticle.summary}</p>}
        {!!activeArticle.tags?.length && <p className="text-sm">Tags: {activeArticle.tags.join(', ')}</p>}
      </header>}
      {blocks.length === 0 ? <div className="bg-[#dce8f3] min-h-[400px] flex"><CanvasEmpty /></div> : blocks.map((block) => {
        const device = previewWidth < 480 ? 'mobile' : previewWidth < 900 ? 'tablet' : 'desktop'
        const hiddenOnCurrentWidth = block.webstudioHiddenOn?.[device] === true
        if (previewMode && hiddenOnCurrentWidth) return null
        const props = Object.fromEntries(Object.entries(block.props).map(([key, value]) => {
          if (typeof value === 'string' && (/^(src|image|logoImage|heroImage|avatar|url)$/i.test(key) || /^section[2-4]Image$/.test(key))) return [key, assetUrls[value] ?? value]
          if (Array.isArray(value)) return [key, value.map(item => item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(Object.entries(item).map(([itemKey, itemValue]) => [itemKey, typeof itemValue === 'string' && /^(src|image|logoImage|heroImage|avatar|url)$/i.test(itemKey) ? assetUrls[itemValue] ?? itemValue : itemKey === 'images' && Array.isArray(itemValue) ? itemValue.map(photo => photo && typeof photo === 'object' && typeof photo.src === 'string' ? { ...photo, src: assetUrls[photo.src] ?? photo.src } : photo) : itemValue]))
            : item)]
          return [key, value]
        }))
        if (typeof block.props.assetId === 'string' && assetUrls[block.props.assetId]) props.src = assetUrls[block.props.assetId]
        if (block.type === 'contact' && !(typeof block.props.recipientEmail === 'string' && block.props.recipientEmail.trim())) props.recipientEmail = webmasterEmail
        return (
        <BlockWrapper
          key={block.id}
          block={{ ...block, props }}
          isSelected={selectedBlockId === block.id}
          hiddenOnCurrentWidth={hiddenOnCurrentWidth}
          onSelect={() => selectBlock(block.id)}
        >
          <RenderBlock block={{ ...block, props }} editable={!previewMode} />
        </BlockWrapper>
        )
      })}
    </div>
  )

  return (
    <div ref={canvasScroll} className="flex-1 flex items-start justify-start p-6 overflow-auto relative bg-[#dce8f3]" onDragOver={event => {
      if (!previewMode && (event.dataTransfer.types.includes('application/x-webstudio-asset') || event.dataTransfer.types.includes('application/x-webstudio-component') || event.dataTransfer.types.includes('application/x-webstudio-block') || event.dataTransfer.types.includes('Files'))) { event.preventDefault(); event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-webstudio-block') ? 'move' : 'copy' }
    }} onDrop={event => {
      if (previewMode) return
      const movingBlockId = event.dataTransfer.getData('application/x-webstudio-block')
      if (movingBlockId) {
        event.preventDefault()
        const target = event.target instanceof Element ? event.target.closest('[data-webstudio-block-id]') : null
        const from = blocks.findIndex(block => block.id === movingBlockId)
        const targetIndex = blocks.findIndex(block => block.id === target?.getAttribute('data-webstudio-block-id'))
        if (from < 0 || targetIndex < 0 || !target) return
        let to = targetIndex + (event.clientY >= target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2 ? 1 : 0)
        if (from < to) to--
        if (to !== from) useConfigStore.getState().moveBlock(from, to)
        selectBlock(movingBlockId)
        return
      }
      const componentType = event.dataTransfer.getData('application/x-webstudio-component')
      if (componentType) {
        const meta = blockMetadata.find(item => item.type === componentType && item.type !== 'pricing')
        if (!meta) return
        event.preventDefault()
        const target = event.target instanceof Element ? event.target.closest('[data-webstudio-block-id]') : null
        const targetId = target?.getAttribute('data-webstudio-block-id')
        const targetIndex = blocks.findIndex(block => block.id === targetId)
        const index = targetIndex < 0 || !target ? undefined : targetIndex + (event.clientY >= target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2 ? 1 : 0)
        const id = `block-${crypto.randomUUID()}`
        useConfigStore.getState().addBlock({ id, type: meta.type, variant: meta.variants[0], props: structuredClone(meta.defaultProps) }, index)
        selectBlock(id)
        toast(`${meta.label} added`)
        return
      }
      const assetId = event.dataTransfer.getData('application/x-webstudio-asset')
      const files = Array.from(event.dataTransfer.files)
      if ((!assetId && !files.length) || !activeProjectId) return
      event.preventDefault()
      const target = event.target instanceof Element ? event.target.closest('[data-webstudio-block-id]') : null
      const rect = target?.getBoundingClientRect()
      const blockId = target?.getAttribute('data-webstudio-block-id')
      const dropped = blockId && rect?.width && rect.height ? { blockId, x: Math.max(0, Math.min(99, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(99, (event.clientY - rect.top) / rect.height * 100)), pageId: activePageId, projectId: activeProjectId } : null
      const destination = dropped
      const sectionElement = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-section]') : null
      const sectionNumber = Number(sectionElement?.dataset.editorSection)
      const sectionBounds = sectionElement?.getBoundingClientRect()
      const sectionDestination = sectionElement && sectionBounds?.width && sectionNumber >= 1 && sectionNumber <= 4 && blockId ? { sectionNumber, blockId, width: sectionBounds.width, x: Math.max(0, Math.min(70, (event.clientX - sectionBounds.left) / sectionBounds.width * 100)), y: Math.max(0, event.clientY - sectionBounds.top) } : null
      const galleryDestination = blockId && (!sectionElement || sectionNumber === 1) && !(event.target instanceof Element && event.target.closest('[data-ws-object-type="panel"],[data-ws-parented="true"]')) && blocks.find(block => block.id === blockId)?.type === 'gallery' ? blockId : null
      const placeAsset = (asset: MediaAsset, offset: number) => {
        if (useEditorStore.getState().activeProjectId !== activeProjectId || useConfigStore.getState().activePageId !== activePageId) throw new Error('The project or page changed; select the intended page and try again.')
        if (galleryDestination && asset.mime.startsWith('image/')) {
          const index = useConfigStore.getState().addGalleryImages(galleryDestination, [{ src: asset.path, assetId: asset.id, alt: asset.name, caption: '' }])
          useEditorStore.getState().selectBlock(galleryDestination)
          useEditorStore.getState().selectCompositeItem({ blockId: galleryDestination, field: 'images', index })
          return
        }
        if (sectionDestination && asset.mime.startsWith('image/')) {
          const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === sectionDestination.blockId)
          if (!block) throw new Error('The selected block no longer exists.')
          const key = `section${sectionDestination.sectionNumber}Objects`, objects = Array.isArray(block.props[key]) ? block.props[key] : []
          const height = asset.width && asset.height ? Math.max(24, sectionDestination.width * .3 * asset.height / asset.width) : 180
          useConfigStore.getState().updateBlockProps(block.id, { [key]: [...objects, { id: `object-${crypto.randomUUID()}`, type: 'image', src: asset.path, assetId: asset.id, alt: asset.name, x: Math.min(70, sectionDestination.x + offset * 2), y: sectionDestination.y + offset * 12, width: 30, height, layer: objects.length + 1 }] })
          useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(sectionDestination.sectionNumber)
          return
        }
        if (destination) {
          const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === destination.blockId)
          if (!block) throw new Error('The selected block no longer exists.')
          const x = Math.min(99, destination.x + offset * 2), y = Math.min(99, destination.y + offset * 2)
          const existing = Array.isArray(block.props.placedMedia) ? block.props.placedMedia : []
          useConfigStore.getState().updateBlockProps(block.id, { placedMedia: [...existing, { id: `placed-${crypto.randomUUID()}`, assetId: asset.id, src: asset.path, name: asset.name, mime: asset.mime, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, width: Math.max(1, Math.min(25, 100 - x)) }] })
          useEditorStore.getState().selectBlock(block.id)
        } else {
          const id = `block-${crypto.randomUUID()}`
          const type = asset.mime === 'application/pdf' ? 'pdfViewer' : asset.mime.startsWith('image/') ? 'image' : asset.mime.startsWith('audio/') ? 'audio' : asset.mime.startsWith('video/') ? 'mediaVideo' : 'document'
          useConfigStore.getState().addBlock({ id, type, variant: type === 'image' ? 'hero-image' : 'default', props: type === 'image' ? { assetId: asset.id, src: asset.path, alt: asset.name, layoutWidth: 40 } : { assetId: asset.id, src: asset.path, title: asset.name, alt: asset.name } })
          useEditorStore.getState().selectBlock(id)
        }
      }
      void (async () => {
        const library = new ProjectMediaLibrary()
        if (assetId) {
          const asset = (await library.list(activeProjectId)).find(item => item.id === assetId)
          if (!asset) throw new Error('The media file is no longer available.')
          placeAsset(asset, 0)
        } else {
          if (useEditorStore.getState().mediaImporting) throw new Error('Wait for the current media import to finish.')
          useEditorStore.getState().setMediaImporting(true)
          try {
            for (const [index, file] of files.entries()) {
              const { asset } = await library.import(activeProjectId, file)
              useProjectsStore.getState().mediaChanged(activeProjectId)
              placeAsset(asset, index)
            }
          } finally { useEditorStore.getState().setMediaImporting(false) }
        }
        toast('Media added to page')
      })().catch(error => toast.error(error instanceof Error ? error.message : 'Media could not be added.'))
    }}>
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #9bb4ca 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {viewport === 'tablet' ? (
        <div className="relative z-[1] shrink-0 mx-auto" style={{ width: previewWidth + 24 }}>
          {/* Tablet frame */}
          <div className="border-[12px] border-bg-4 rounded-2xl bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="rounded-lg overflow-hidden">
              {canvasContent}
            </div>
          </div>
        </div>
      ) : viewport === 'mobile' ? (
        <div className="relative z-[1] shrink-0 mx-auto" style={{ width: previewWidth + 20 }}>
          {/* Phone frame */}
          <div className="border-[10px] border-bg-4 rounded-[2rem] bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            {/* Notch */}
            <div className="flex justify-center -mt-[4px] mb-1">
              <div className="w-24 h-5 bg-bg-4 rounded-b-xl" />
            </div>
            <div className="rounded-xl overflow-hidden">
              {canvasContent}
            </div>
            {/* Home indicator */}
            <div className="flex justify-center mt-2 pb-1">
              <div className="w-28 h-1 bg-bg-5 rounded-full" />
            </div>
          </div>
        </div>
      ) : (
        canvasContent
      )}
    </div>
  )
}
