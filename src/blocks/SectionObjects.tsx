import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import type { BlockConfig } from './types'
import { RichText } from './RichText'
import { CollageBlock } from './collage/CollageBlock'

type SectionObject = { id: string; type: 'text' | 'image' | 'button' | 'panel' | 'collage' | 'divider'; anchorName?: string; images?: unknown[]; parentId?: string; text?: string; src?: string; alt?: string; url?: string; color?: string; backgroundColor?: string; borderColor?: string; textColor?: string; fontSize?: number; lineOrientation?: 'horizontal' | 'vertical'; lineStyle?: 'solid' | 'dashed' | 'dotted' | 'double'; lineThickness?: number; x: number; y: number; width: number; height: number; layer: number }

export function SectionObjects({ block, section, editable }: { block: BlockConfig; section: number; editable: boolean }) {
  const key = `section${section}Objects`
  const objects = useMemo(() => Array.isArray(block.props[key]) ? block.props[key] as SectionObject[] : [], [block.props, key])
  const responsiveOrder = objects.filter(item => item && typeof item.id === 'string').slice().sort((a, b) => {
    const parentA = objects.find(item => item?.id === a.parentId && item.type === 'panel')
    const parentB = objects.find(item => item?.id === b.parentId && item.type === 'panel')
    const anchorA = parentA ?? a, anchorB = parentB ?? b
    return (Number(anchorA.y) || 0) - (Number(anchorB.y) || 0) || (Number(anchorA.x) || 0) - (Number(anchorB.x) || 0) || (parentA ? 1 : 0) - (parentB ? 1 : 0) || (Number(a.y) || 0) - (Number(b.y) || 0)
  }).map(item => item.id)
  const objectSelection = useEditorStore(state => state.selectedSectionObject)
  const multiSelection = useEditorStore(state => state.selectedSectionObjects)
  const selected = objectSelection?.blockId === block.id && objectSelection.section === section ? objectSelection.id : null
  const setSelected = (id: string | null) => useEditorStore.getState().selectSectionObject(id ? { blockId: block.id, section, id } : null)
  const [editing, setEditing] = useState<string | null>(null)
  const newTextObjectId = useEditorStore(state => state.newTextObjectId)
  useEffect(() => {
    if (!newTextObjectId || !objects.some(item => item.id === newTextObjectId)) return
    const timer = window.setTimeout(() => {
      useEditorStore.getState().selectSectionObject({ blockId: block.id, section, id: newTextObjectId })
      setEditing(newTextObjectId)
      useEditorStore.getState().setNewTextObjectId(null)
      requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-section-object="${newTextObjectId}"] [contenteditable="true"]`)
      if (!element) return
      element.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(element)
      selection?.removeAllRanges()
      selection?.addRange(range)
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [newTextObjectId, objects, block.id, section])
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; layers: string[] } | null>(null)
  const menuElement = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = menuElement.current
    if (!menu || !element) return
    const place = () => {
      element.style.maxHeight = 'calc(100vh - 24px)'
      const bounds = element.getBoundingClientRect()
      element.style.left = `${Math.max(12, Math.min(menu.x, window.innerWidth - bounds.width - 12))}px`
      element.style.top = `${Math.max(12, Math.min(menu.y, (window.innerHeight - bounds.height) / 2))}px`
    }
    place()
    const observer = new ResizeObserver(place); observer.observe(element)
    window.addEventListener('resize', place)
    return () => { observer.disconnect(); window.removeEventListener('resize', place) }
  }, [menu])
  const [destination, setDestination] = useState<{ id: string; kind: 'anchor' | 'link'; value: string; error: string; x: number; y: number } | null>(null)
  const [guides, setGuides] = useState<{ vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } }>({})
  const drag = useRef<{ id: string; startX: number; startY: number; grabX: number; grabY: number; x: number; y: number; width: number; height: number; parentWidth: number; resize: false | string; imageAspect?: number; group?: string[]; editOnClick?: boolean } | null>(null)

  function editText(object: HTMLElement, id: string, point?: { x: number; y: number }) {
    setEditing(id)
    requestAnimationFrame(() => {
      const editor = object.querySelector<HTMLElement>('[contenteditable="true"]')
      if (!editor) return
      editor.focus({ preventScroll: true })
      let caret = point ? document.caretRangeFromPoint?.(point.x, point.y) : null
      if (!caret || !editor.contains(caret.startContainer)) {
        caret = document.createRange()
        caret.selectNodeContents(editor)
        caret.collapse(false)
      }
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(caret)
    })
  }

  function move(event: PointerEvent<HTMLElement>, finish = false) {
    const state = drag.current
    if (!state) return
    if (finish && !state.resize && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 3) {
      const element = event.currentTarget.closest<HTMLElement>('[data-section-object]')
      if (element) {
        element.style.left = `${state.x}%`; element.style.top = `${state.y}px`
        for (const child of objects.filter(item => item.parentId === state.id)) {
          const childElement = element.closest('[data-section-object-area]')?.querySelector<HTMLElement>(`[data-section-object="${child.id}"]`)
          if (childElement) { childElement.style.left = `${child.x}%`; childElement.style.top = `${child.y}px` }
        }
      }
      drag.current = null
      setGuides({})
      if (element && state.editOnClick) editText(element, state.id, { x: event.clientX, y: event.clientY })
      event.preventDefault(); event.stopPropagation()
      return
    }
    const dx = (event.clientX - state.startX) / state.parentWidth * 100
    const dy = event.clientY - state.startY
    const direction = state.resize || ''
    let width = direction.includes('w') ? Math.max(5, Math.min(state.width + state.x, state.width - dx)) : direction.includes('e') ? Math.max(5, Math.min(100 - state.x, state.width + dx)) : state.width
    let height = direction.includes('n') ? Math.max(24, Math.min(state.height + state.y, state.height - dy)) : direction.includes('s') ? Math.max(24, state.height + dy) : state.height
    if (state.imageAspect && state.resize) {
      if (direction === 'n' || direction === 's') width = Math.max(5, Math.min(100 - state.x, height * state.imageAspect / state.parentWidth * 100))
      else height = Math.max(24, width * state.parentWidth / 100 / state.imageAspect)
    }
    let x = state.resize ? direction.includes('w') ? state.x + state.width - width : state.x : Math.max(0, Math.min(100 - state.width, state.x + dx))
    let y = state.resize ? direction.includes('n') ? state.y + state.height - height : state.y : Math.max(0, state.y + dy)
    if (!state.resize && (state.group?.length ?? 0) > 1) {
      const group = objects.filter(item => state.group?.includes(item.id) || (item.parentId && state.group?.includes(item.parentId)))
      const minimumX = Math.max(...group.map(item => -item.x))
      const maximumX = Math.min(...group.map(item => 100 - item.width - item.x))
      const minimumY = Math.max(...group.map(item => -item.y))
      x = state.x + Math.max(minimumX, Math.min(maximumX, dx))
      y = state.y + Math.max(minimumY, dy)
    }
    const element = event.currentTarget.closest<HTMLElement>('[data-section-object]')
    if (element) Object.assign(element.style, { left: `${!finish && !state.resize && !state.group?.length ? state.x + dx : x}%`, top: `${!finish && !state.resize && !state.group?.length ? state.y + dy : y}px`, width: `${width}%`, height: `${height}px` })
    if (!state.resize && state.group && element) for (const member of objects.filter(value => (state.group?.includes(value.id) || (value.parentId && state.group?.includes(value.parentId))) && value.id !== state.id)) {
      const node = element.closest('[data-section-object-area]')?.querySelector<HTMLElement>(`[data-section-object="${member.id}"]`)
      if (node) Object.assign(node.style, { left: `${Math.max(0, Math.min(100 - member.width, member.x + x - state.x))}%`, top: `${Math.max(0, member.y + y - state.y)}px` })
    }
    if (!state.resize && element && objects.some(item => item.id === state.id && item.type === 'panel')) {
      for (const child of objects.filter(item => item.parentId === state.id)) {
        const childElement = element.closest('[data-section-object-area]')?.querySelector<HTMLElement>(`[data-section-object="${child.id}"]`)
        if (childElement) Object.assign(childElement.style, { left: `${child.x + x - state.x}%`, top: `${child.y + y - state.y}px` })
      }
    }
    if (!state.resize && element) {
      const canvas = element.closest('[aria-label^="Site preview"]')
      const current = element.getBoundingClientRect()
      const matches: { vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } } = {}
      let snapX = 0, snapY = 0
      canvas?.querySelectorAll<HTMLElement>('[data-section-object], [data-placed-media], [data-ws-image-index], [contenteditable="true"]').forEach(other => {
        if (other === element || element.contains(other) || other.contains(element)) return
        const rect = other.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        if (!matches.vertical) for (const [a, b] of [[current.left, rect.left], [current.right, rect.right], [(current.left + current.right) / 2, (rect.left + rect.right) / 2]]) {
          if (Math.abs(a - b) <= 4) { const top = Math.min(current.top, rect.top); matches.vertical = { x: b, top, height: Math.max(current.bottom, rect.bottom) - top }; snapX = b - a; break }
        }
        if (!matches.horizontal) for (const [a, b] of [[current.top, rect.top], [current.bottom, rect.bottom], [(current.top + current.bottom) / 2, (rect.top + rect.bottom) / 2]]) {
          if (Math.abs(a - b) <= 4) { const left = Math.min(current.left, rect.left); matches.horizontal = { y: b, left, width: Math.max(current.right, rect.right) - left }; snapY = b - a; break }
        }
      })
      if (block.props.snapSectionObjects === true) {
        x = Math.max(0, Math.min(100 - width, x + snapX / state.parentWidth * 100)); y = Math.max(0, y + snapY)
        Object.assign(element.style, { left: `${finish ? x : state.x + dx + snapX / state.parentWidth * 100}%`, top: `${finish ? y : state.y + dy + snapY}px` })
      }
      if (!finish) setGuides(matches)
    }
    event.preventDefault(); event.stopPropagation()
    if (finish) {
      setGuides({})
      drag.current = null
      const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
      const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []
      if (!state.resize && element && current && (state.group?.length ?? 0) < 2) {
        const previous = element.style.pointerEvents
        element.style.pointerEvents = 'none'
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-editor-section]')
        element.style.pointerEvents = previous
        const targetSection = Number(target?.dataset.editorSection)
        const targetBlock = target?.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id')
        const area = target?.querySelector<HTMLElement>(`[data-section-object-area="${targetSection}"]`)
        const moving = saved.find(item => item.id === state.id)
        if (moving && area && targetBlock && targetSection >= 1 && targetSection <= 4 && (targetBlock !== block.id || targetSection !== section)) {
          const bounds = area.getBoundingClientRect()
          const nextWidth = bounds.width ? Math.max(5, Math.min(100, width * state.parentWidth / bounds.width)) : width
          const nextX = bounds.width ? Math.max(0, Math.min(100 - nextWidth, (event.clientX - state.grabX - bounds.left) / bounds.width * 100)) : 0
          useConfigStore.getState().moveSectionObject(block.id, section, targetBlock, targetSection, state.id, nextX, Math.max(0, event.clientY - state.grabY - bounds.top), nextWidth, height)
          useEditorStore.getState().selectBlock(targetBlock)
          useEditorStore.getState().selectSection(targetSection)
          setSelected(null)
          return
        }
      }
      const moving = saved.find(item => item.id === state.id)
      let parentId = moving?.parentId
      if (!state.resize && moving && moving.type !== 'panel' && element && (state.group?.length ?? 0) < 2) {
        const previous = element.style.pointerEvents
        element.style.pointerEvents = 'none'
        const hitId = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-section-object]')?.getAttribute('data-section-object')
        element.style.pointerEvents = previous
        parentId = saved.find(item => item.id === hitId && item.type === 'panel')?.id
      }
      useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(item => item.id === state.id ? { ...item, x, y, width, height, ...(parentId ? { parentId } : { parentId: undefined }) } : !state.resize && (state.group?.includes(item.id) || (item.parentId && state.group?.includes(item.parentId)) || (moving?.type === 'panel' && item.parentId === state.id)) ? { ...item, x: Math.max(0, Math.min(100 - item.width, item.x + x - state.x)), y: Math.max(0, item.y + y - state.y) } : item) })
    }
  }
  const visibleObjects = objects.filter(item => item && typeof item.id === 'string' && ['text', 'image', 'button', 'panel', 'collage', 'divider'].includes(item.type))
  const groups = visibleObjects.filter(item => item.type === 'panel' || !visibleObjects.some(value => value.id === item.parentId && value.type === 'panel')).map(item => {
    const members = [item, ...visibleObjects.filter(value => value.type !== 'panel' && value.parentId === item.id)]
    return { item, members, left: Math.min(...members.map(value => Number(value.x) || 0)), right: Math.max(...members.map(value => (Number(value.x) || 0) + (Number(value.width) || 30))), top: Math.min(...members.map(value => Number(value.y) || 0)), bottom: Math.max(...members.map(value => (Number(value.y) || 0) + (Number(value.height) || 80))) }
  }).sort((a, b) => a.top - b.top || a.left - b.left)
  const rows: { bottom: number; groups: typeof groups }[] = []
  for (const group of groups) {
    const row = rows[rows.length - 1]
    if (row && group.top < row.bottom - 1) { row.groups.push(group); row.bottom = Math.max(row.bottom, group.bottom) }
    else rows.push({ bottom: group.bottom, groups: [group] })
  }
  const responsiveRows = rows.map(row => {
    const columns: { left: number; right: number; groups: typeof groups }[] = []
    for (const group of [...row.groups].sort((a, b) => a.left - b.left)) {
      const column = columns[columns.length - 1]
      if (column && group.left < column.right - 1) { column.groups.push(group); column.right = Math.max(column.right, group.right) }
      else columns.push({ left: group.left, right: group.right, groups: [group] })
    }
    return columns
  })
  const columnsById = new Map(responsiveRows.flatMap(columns => columns.flatMap(column => column.groups.flatMap(group => group.members.map(item => [item.id, column] as const)))))
  const renderedObjects = new Map(visibleObjects.map(item => {
      const x = Math.max(0, Math.min(95, Number(item.x) || 0)), y = Math.max(0, Number(item.y) || 0)
      const width = Math.max(5, Math.min(100 - x, Number(item.width) || 30)), height = Math.max(24, Number(item.height) || 80)
      const link = typeof item.url === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(item.url) ? item.url : undefined
      const buttonStyle = { backgroundColor: /^#[0-9a-f]{6}$/i.test(item.backgroundColor || '') ? item.backgroundColor : undefined, color: /^#[0-9a-f]{6}$/i.test(item.textColor || '') ? item.textColor : undefined, borderColor: /^#[0-9a-f]{6}$/i.test(item.borderColor || '') ? item.borderColor : 'currentColor' }
      const parent = objects.find(value => value?.id === item.parentId && value.type === 'panel')
      const column = columnsById.get(item.id)
      const columnWidth = Math.max(1, (column?.right ?? 100) - (column?.left ?? 0))
      const gridColumn = Math.max(1, Math.min(12, Math.round((x - (column?.left ?? 0)) / columnWidth * 12) + 1))
      const gridSpan = Math.max(1, Math.min(13 - gridColumn, Math.round(width / columnWidth * 12)))
      const emptyPanel = item.type === 'panel' && !item.text && !item.src && !block.props[`sectionObject_${item.id}`] && !block.props[`sectionObject_${item.id}Rich`] && objects.some(value => value?.parentId === item.id)
      // Route the first click to the editor element even when its formatted text is raw markup.
      const textHitArea = editable && (item.type === 'text' || item.type === 'panel')
        ? '[&_[data-rich-text]:not(:focus)>*]:pointer-events-none' : undefined
      return [item.id, <div key={item.id} id={typeof item.anchorName === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(item.anchorName) ? item.anchorName : undefined} data-section-object={item.id} data-ws-object-type={item.type} className={textHitArea} data-ws-parented={parent ? 'true' : undefined} data-ws-empty-panel={emptyPanel ? 'true' : undefined} tabIndex={editable ? 0 : undefined} aria-label={editable ? `${item.type} in section ${section}` : undefined} style={{ position: 'absolute', left: `${x}%`, top: y, width: `${width}%`, height: item.type === 'text' ? 'auto' : height, minHeight: item.type === 'text' ? height : undefined, order: responsiveOrder.indexOf(item.id), '--ws-grid-column': gridColumn, '--ws-grid-span': gridSpan, '--ws-item-width': width, '--ws-parent-background': parent && /^#[0-9a-f]{6}$/i.test(parent.color || '') ? parent.color : 'transparent', zIndex: Number(item.layer) || 1, pointerEvents: 'auto', outline: editable && multiSelection.some(value => value.blockId === block.id && value.section === section && value.id === item.id) ? '1px solid #005a9e' : undefined, touchAction: editable ? 'none' : undefined, cursor: editable ? 'move' : undefined, background: item.type === 'panel' && /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : undefined, color: /^#[0-9a-f]{6}$/i.test(item.textColor || '') ? item.textColor : undefined, fontSize: Number(item.fontSize) >= 6 && Number(item.fontSize) <= 200 ? Number(item.fontSize) : undefined } as CSSProperties}
        onContextMenu={event => { if (!editable || (editing === item.id && event.target instanceof Element && event.target.closest('[contenteditable="true"]'))) return; event.preventDefault(); event.stopPropagation(); useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); setSelected(item.id); const layers = Array.from(new Set(document.elementsFromPoint(event.clientX, event.clientY).map(element => element.closest<HTMLElement>('[data-section-object]')).filter((element): element is HTMLElement => !!element && element.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id') === block.id && Number(element.closest<HTMLElement>('[data-editor-section]')?.dataset.editorSection) === section).map(element => element.dataset.sectionObject || '').filter(id => objects.some(value => value.id === id)))); setMenu({ id: item.id, x: event.clientX, y: event.clientY, layers }) }}
        onDoubleClick={event => {
          if (!editable || (item.type !== 'text' && item.type !== 'panel') || (event.target instanceof Element && event.target.closest('[contenteditable="true"]'))) return
          event.stopPropagation()
          useEditorStore.getState().selectBlock(block.id)
          useEditorStore.getState().selectSection(section)
          setSelected(item.id)
          editText(event.currentTarget, item.id, { x: event.clientX, y: event.clientY })
        }}
        onKeyDownCapture={event => {
          if (!editable) return
          if (event.key === 'Escape' && editing === item.id && event.target instanceof HTMLElement && event.target.isContentEditable && !document.querySelector('[data-rich-menu]')) {
            event.preventDefault()
            event.stopPropagation()
            event.target.blur()
            setEditing(null)
            event.currentTarget.focus({ preventScroll: true })
          } else if ((event.key === 'Enter' || event.key === 'F2') && event.target === event.currentTarget && (item.type === 'text' || item.type === 'panel')) {
            event.preventDefault()
            event.stopPropagation()
            useEditorStore.getState().selectBlock(block.id)
            useEditorStore.getState().selectSection(section)
            setSelected(item.id)
            editText(event.currentTarget, item.id)
          }
        }}
        onCopy={event => { if (!editable || event.target !== event.currentTarget) return; const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []; const original = saved.find(value => value.id === item.id); if (!original || !current) return; const token = crypto.randomUUID(); useEditorStore.getState().setCopiedSectionObject({ token, projectId: useEditorStore.getState().activeProjectId, item: structuredClone(original) as unknown as Record<string, unknown>, text: structuredClone(current.props[`sectionObject_${item.id}`]), rich: structuredClone(current.props[`sectionObject_${item.id}Rich`]) }); event.clipboardData.setData('text/plain', `WebStudio object:${token}`); event.preventDefault(); event.stopPropagation() }}
        onKeyDown={event => { if (!editable || event.target !== event.currentTarget) return; const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []; if (event.key === 'Enter' && item.type === 'image' && current) { const spaceKey = `section${section}ExtraSpace`; useConfigStore.getState().updateBlockProps(block.id, { [spaceKey]: Math.min(4000, Math.max(0, Number(current.props[spaceKey]) || 0) + 32) }); event.preventDefault(); event.stopPropagation(); return }; if (event.key === 'Delete' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd')) { const index = saved.findIndex(value => value.id === item.id); if (index >= 0) useConfigStore.getState().editBlockItems(block.id, key, index, index, event.key === 'Delete' ? 'remove' : 'duplicate'); if (event.key === 'Delete') setSelected(null); event.preventDefault(); event.stopPropagation(); return }; if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1; const area = event.currentTarget.closest<HTMLElement>('[data-section-object-area]'); const horizontal = area?.clientWidth ? step / area.clientWidth * 100 : 0; useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(value => { const nextX = Math.max(0, Math.min(100 - width, x + (event.key === 'ArrowRight' ? horizontal : event.key === 'ArrowLeft' ? -horizontal : 0))); const nextY = Math.max(0, y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)); return value.id === item.id ? { ...value, x: nextX, y: nextY } : item.type === 'panel' && value.parentId === item.id ? { ...value, x: value.x + nextX - x, y: value.y + nextY - y } : value }) }) }}
        onPointerDown={event => {
          if (!editable || event.button !== 0 || (event.target instanceof Element && event.target.closest('[data-rich-menu]'))) return
          const text = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-rich-text]') : null
          if (selected === item.id && editing === item.id && text?.isContentEditable) return
          const moveHandle = event.target instanceof Element && event.target.closest('[data-text-move-handle]')
          const editOnClick = !event.ctrlKey && !event.metaKey && !event.altKey && !moveHandle && (item.type === 'text' || (item.type === 'panel' && !!text?.textContent?.trim()))
          const textMenu = document.querySelector<HTMLButtonElement>('[aria-label="Close text settings"]')
          if (item.type === 'panel' && textMenu) { textMenu.click(); setEditing(null) }
          if (event.shiftKey) { event.preventDefault(); event.stopPropagation(); useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); useEditorStore.getState().toggleSectionObject({ blockId: block.id, section, id: item.id }); setEditing(null); return }
          if (item.type !== 'text' && item.type !== 'panel' && !event.ctrlKey && !event.metaKey && useEditorStore.getState().selectionPreference === 'parent' && (editing !== item.id || textMenu)) {
            const underlying = document.elementsFromPoint(event.clientX, event.clientY).map(element => element.closest<HTMLElement>('[data-section-object]')).find(element => element && element.dataset.wsObjectType === 'panel' && element.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id') === block.id && Number(element.closest<HTMLElement>('[data-editor-section]')?.dataset.editorSection) === section)
            const panelId = underlying?.dataset.sectionObject
            if (panelId) { textMenu?.click(); useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); setSelected(panelId); setEditing(null); underlying?.focus({ preventScroll: true }); event.preventDefault(); event.stopPropagation(); return }
          }
          const area = event.currentTarget.closest<HTMLElement>('[data-section-object-area]'); if (!area?.clientWidth) return
          const group = useEditorStore.getState().selectedSectionObjects.filter(value => value.blockId === block.id && value.section === section).map(value => value.id)
          const bounds = event.currentTarget.getBoundingClientRect(); event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); if (!group.includes(item.id)) setSelected(item.id); setEditing(null); drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, grabX: event.clientX - bounds.left, grabY: event.clientY - bounds.top, x, y, width, height, parentWidth: area.clientWidth, resize: false, group: group.includes(item.id) ? group : undefined, editOnClick }; event.currentTarget.setPointerCapture(event.pointerId)
        }} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null; setGuides({}) }}>
        {(item.type === 'image' || item.type === 'panel') && item.src && (item.type === 'image' && link
          ? <a href={link} onClick={editable ? event => event.preventDefault() : undefined} style={{ display: 'block', width: '100%', height: '100%' }}><img src={item.src} alt={item.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} /></a>
          : <img src={item.src} alt={item.alt || ''} style={{ width: '100%', height: item.type === 'image' ? '100%' : '50%', objectFit: 'contain' }} draggable={false} />)}
        {editable && item.type === 'image' && !item.src && <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', border: '1px dashed #8290a0', color: '#8290a0' }}>Choose an image in Properties</div>}
        {editable && item.type === 'collage' && (!item.images || item.images.length === 0) && selected !== item.id && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', border: '1px dashed #8290a0', color: '#8290a0' }}>Select collage and add images in Properties</div>}
        {item.type === 'collage' && <CollageBlock block={{ ...block, props: { ...block.props, images: item.images ?? [] } }} editable={editable && selected === item.id} sectionObject={{ section, id: item.id }} />}
        {item.type === 'divider' && <div aria-label={item.lineOrientation === 'vertical' ? 'Vertical line' : 'Horizontal line'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><div style={item.lineOrientation === 'vertical' ? { height: '100%', borderLeft: `${Math.max(1, Math.min(20, Number(item.lineThickness) || 1))}px ${['solid', 'dashed', 'dotted', 'double'].includes(item.lineStyle || '') ? item.lineStyle : 'solid'} ${/^#[0-9a-f]{6}$/i.test(item.textColor || '') ? item.textColor : '#808080'}` } : { width: '100%', borderTop: `${Math.max(1, Math.min(20, Number(item.lineThickness) || 1))}px ${['solid', 'dashed', 'dotted', 'double'].includes(item.lineStyle || '') ? item.lineStyle : 'solid'} ${/^#[0-9a-f]{6}$/i.test(item.textColor || '') ? item.textColor : '#808080'}` }} /></div>}
        {(item.type === 'text' || item.type === 'panel') && <RichText blockId={block.id} field={`sectionObject_${item.id}`} text={typeof block.props[`sectionObject_${item.id}`] === 'string' ? block.props[`sectionObject_${item.id}`] as string : item.text || ''} value={block.props[`sectionObject_${item.id}Rich`]} editable={editable && editing === item.id} multiline onDeleteBox={item.type === 'text' ? () => { const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []; const index = saved.findIndex(value => value.id === item.id); if (index >= 0) useConfigStore.getState().editBlockItems(block.id, key, index, index, 'remove'); setEditing(null); setSelected(null) } : undefined} />}
        {item.type === 'button' && (link ? <a data-ws-object-button href={link} style={buttonStyle} onClick={editable ? event => event.preventDefault() : undefined} className="inline-block rounded border px-4 py-2">{item.text || 'Button'}</a> : <span data-ws-object-button style={buttonStyle} className="inline-block rounded border px-4 py-2">{item.text || 'Button'}</span>)}
        {editable && selected === item.id && <div aria-hidden="true" data-text-move-handle title="Drag to move" style={{ position: 'absolute', left: 6, right: 6, top: 0, height: 7, zIndex: 1, cursor: 'move', touchAction: 'none' }} />}
        {editable && selected === item.id && (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map(direction => <button key={direction} type="button" aria-label={`Resize object ${direction}`} style={{ position: 'absolute', left: direction.includes('w') ? -6 : direction.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', top: direction.includes('n') ? -6 : direction.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', width: 12, height: 12, zIndex: 2, background: 'white', border: '1px solid black', cursor: `${direction}-resize`, touchAction: 'none' }} onPointerDown={event => { const parent = event.currentTarget.closest<HTMLElement>('[data-section-object-area]'); if (!parent?.clientWidth) return; event.preventDefault(); event.stopPropagation(); const object = event.currentTarget.parentElement; const image = item.type === 'image' ? object?.querySelector<HTMLImageElement>('img') : null; const aspect = image?.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : undefined; let startX = x, startY = y, startWidth = width, startHeight = height; if (aspect && object) { const bounds = object.getBoundingClientRect(); const visibleWidth = Math.min(bounds.width, bounds.height * aspect); const visibleHeight = visibleWidth / aspect; startX += (bounds.width - visibleWidth) / 2 / parent.clientWidth * 100; startY += (bounds.height - visibleHeight) / 2; startWidth = visibleWidth / parent.clientWidth * 100; startHeight = visibleHeight }; drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, grabX: 0, grabY: 0, x: startX, y: startY, width: startWidth, height: startHeight, parentWidth: parent.clientWidth, resize: direction, imageAspect: aspect }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null }} />)}
      </div>] as const
    }))
  return <><div data-section-object-area={section} data-ws-has-right={objects.some(item => item && Number(objects.find(value => value?.id === item.parentId && value.type === 'panel')?.x ?? item.x) >= 60) ? 'true' : undefined} className="ws-stack-mobile" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {responsiveRows.map((columns, rowIndex) => <div key={rowIndex} data-ws-responsive-row style={{ display: 'contents', '--ws-row-columns': columns.map(column => `minmax(0, ${Math.max(1, column.right - column.left)}fr)`).join(' ') } as CSSProperties}>
    {columns.map((column, columnIndex) => <div key={columnIndex} data-ws-responsive-column={columnIndex} style={{ display: 'contents' }}>
      {column.groups.sort((a, b) => a.top - b.top || a.left - b.left).map(({ item }) => {
        const children = item.type === 'panel' ? visibleObjects.filter(value => value.type !== 'panel' && value.parentId === item.id) : []
        const background = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : 'transparent'
        return <div key={item.id} data-ws-object-group data-ws-group-panel={children.length ? 'true' : undefined} style={{ display: 'contents', order: responsiveOrder.indexOf(item.id), '--ws-group-width': Number(item.width) || 30, '--ws-group-background': background } as CSSProperties}>
          {renderedObjects.get(item.id)}
          {children.map(child => renderedObjects.get(child.id))}
        </div>
      })}
    </div>)}
    </div>)}
  </div>
  {editable && (guides.vertical || guides.horizontal) && createPortal(<div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
    {guides.vertical && <div style={{ position: 'fixed', left: guides.vertical.x, top: guides.vertical.top, height: guides.vertical.height, width: 1, background: '#1683e5' }} />}
    {guides.horizontal && <div style={{ position: 'fixed', left: guides.horizontal.left, top: guides.horizontal.y, width: guides.horizontal.width, height: 1, background: '#1683e5' }} />}
  </div>, document.body)}
  {editable && menu && createPortal(<div ref={menuElement} role="menu" aria-label="Object actions" style={{ position: 'fixed', left: Math.max(0, Math.min(menu.x, window.innerWidth - 190)), top: Math.max(8, Math.min(menu.y, window.innerHeight - 340)), maxHeight: 'calc(100vh - 16px)', overflowY: 'auto', zIndex: 10001 }} className="rounded border border-gray-400 bg-white p-1 text-sm text-black shadow-lg" onClick={event => event.stopPropagation()} onMouseLeave={() => setMenu(null)} onKeyDown={event => { if (event.key === 'Escape') setMenu(null) }}>
    <button type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => {
      const item = objects.find(value => value.id === menu.id)
      if (item?.type === 'text') {
        const { id, x, y } = menu
        setMenu(null); setEditing(id)
        document.querySelector<HTMLButtonElement>('[aria-label="Close settings"]')?.click()
        requestAnimationFrame(() => {
          const element = Array.from(document.querySelectorAll<HTMLElement>('[data-section-object]')).find(value => value.dataset.sectionObject === id)?.querySelector<HTMLElement>('[contenteditable="true"]')
          if (!element) return
          element.focus()
          element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }))
        })
      } else { useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); setSelected(menu.id); setMenu(null); document.querySelector<HTMLButtonElement>('[aria-label="Expand right panel"]')?.click(); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-properties-tab]')?.click()) }
    }}>Properties</button>
    {menu.layers.length > 1 && <div className="my-1 border-y border-gray-200 py-1"><div className="px-3 py-1 text-xs text-gray-600">Select overlapping item</div>{menu.layers.map(id => { const item = objects.find(value => value.id === id); if (!item) return null; const name = (item.type === 'image' ? item.alt : item.text)?.trim().slice(0, 36); return <button key={id} type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => { useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); setSelected(id); setEditing(null); setMenu(null) }}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}{name ? `: ${name}` : ''}{id === menu.id ? ' ✓' : ''}</button> })}<div className="px-3 py-1 text-[10px] text-gray-600">Alt+click also cycles through overlapping items.</div></div>}
    {(['anchor', ...(objects.find(item => item.id === menu.id && (item.type === 'image' || item.type === 'button')) ? ['link'] : [])] as ('anchor' | 'link')[]).map(kind => <button key={kind} type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => {
      const item = objects.find(value => value.id === menu.id)
      if (!item) return
      document.querySelector<HTMLButtonElement>('[aria-label="Close settings"]')?.click()
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-section-object]')).find(element => element.dataset.sectionObject === item.id)?.getBoundingClientRect()
      const x = target && target.right + 332 <= window.innerWidth ? target.right + 12 : target && target.left >= 332 ? target.left - 332 : menu.x
      setDestination({ id: item.id, kind, value: kind === 'anchor' ? item.anchorName || '' : item.url || '', error: '', x: Math.max(8, Math.min(x, window.innerWidth - 328)), y: Math.max(8, Math.min(target?.top ?? menu.y, window.innerHeight - 280)) })
      setMenu(null)
    }}>{kind === 'anchor' ? 'Anchor…' : 'Link…'}</button>)}
    <button type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => {
      const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
      const spaceKey = `section${section}ExtraSpace`
      if (current) useConfigStore.getState().updateBlockProps(block.id, { [spaceKey]: Math.min(4000, Math.max(0, Number(current.props[spaceKey]) || 0) + 32) })
      setMenu(null)
    }}>Add space below</button>
    {(['Copy', 'Duplicate', 'Bring to front', 'Bring forward', 'Send backward', 'Send to back', 'Delete'] as const).map(action => <button key={action} type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => {
      const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
      const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []
      const index = saved.findIndex(value => value.id === menu.id)
      if (index >= 0) {
        if (action === 'Copy' && current) { const token = crypto.randomUUID(); useEditorStore.getState().setCopiedSectionObject({ token, projectId: useEditorStore.getState().activeProjectId, item: structuredClone(saved[index]) as unknown as Record<string, unknown>, text: structuredClone(current.props[`sectionObject_${menu.id}`]), rich: structuredClone(current.props[`sectionObject_${menu.id}Rich`]) }); void navigator.clipboard?.writeText(`WebStudio object:${token}`).catch(() => {}) }
        else if (action === 'Duplicate' || action === 'Delete') useConfigStore.getState().editBlockItems(block.id, key, index, index, action === 'Duplicate' ? 'duplicate' : 'remove')
        else {
          const ordered = saved.map((value, position) => ({ value, position })).sort((a, b) => (Number(a.value.layer) || 1) - (Number(b.value.layer) || 1) || a.position - b.position)
          const old = ordered.findIndex(entry => entry.value.id === menu.id)
          const [chosen] = ordered.splice(old, 1)
          const target = action === 'Bring to front' ? ordered.length : action === 'Send to back' ? 0 : action === 'Bring forward' ? Math.min(ordered.length, old + 1) : Math.max(0, old - 1)
          ordered.splice(target, 0, chosen)
          useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(value => ({ ...value, layer: ordered.findIndex(entry => entry.value.id === value.id) + 1 })) })
        }
      }
      if (action === 'Delete') setSelected(null)
      setMenu(null)
    }}>{action}</button>)}
  </div>, document.body)}
  {editable && destination && createPortal(<div role="dialog" aria-label={destination.kind === 'anchor' ? 'Anchor settings' : 'Link settings'} style={{ left: destination.x, top: destination.y, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }} className="fixed z-[10002] w-80 max-w-[calc(100vw-32px)] rounded border border-gray-300 bg-white p-4 text-sm text-gray-900 shadow-xl" onKeyDown={event => { if (event.key === 'Escape') setDestination(null) }}>
    <div className="mb-3 flex items-center justify-between"><strong>{destination.kind === 'anchor' ? 'Anchor settings' : 'Link settings'}</strong><button type="button" aria-label="Close" onClick={() => setDestination(null)}>×</button></div>
    <label className="block">{destination.kind === 'anchor' ? 'Anchor name' : 'Link destination'}<input autoFocus aria-label={destination.kind === 'anchor' ? 'Anchor name' : 'Link destination'} value={destination.value} onChange={event => setDestination({ ...destination, value: event.target.value, error: '' })} className="mt-1 w-full rounded border border-gray-400 p-2" placeholder={destination.kind === 'anchor' ? 'e.g. parish-mass-times' : 'https://example.com or #anchor'} /></label>
    {destination.kind === 'anchor' && <p className="mt-2 text-xs text-gray-600">Start with a letter; use letters, numbers, hyphens or underscores.</p>}
    {destination.kind === 'link' && <label className="mt-2 block text-xs">Or choose a location on this page<select aria-label="Choose a location on this page" value={destination.value.startsWith('#') ? destination.value : ''} onChange={event => setDestination({ ...destination, value: event.target.value, error: '' })} className="mt-1 w-full rounded border border-gray-400 p-2"><option value="">Choose a location…</option>{useConfigStore.getState().getActivePageBlocks().flatMap(candidate => [candidate.props.anchorName, ...[1, 2, 3, 4].flatMap(number => Array.isArray(candidate.props[`section${number}Objects`]) ? (candidate.props[`section${number}Objects`] as SectionObject[]).map(item => item.anchorName) : [])]).filter((name): name is string => typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)).map(name => <option key={name} value={`#${name}`}>{name}</option>)}</select></label>}
    {destination.error && <p role="alert" className="mt-2 text-xs text-red-700">{destination.error}</p>}
    <div className="mt-4 flex justify-end gap-2"><button type="button" className="rounded border border-gray-400 px-3 py-1" onClick={() => setDestination(null)}>Cancel</button><button type="button" className="rounded bg-blue-700 px-3 py-1 text-white" onClick={() => {
      const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
      const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []
      const value = destination.value.trim()
      if (!saved.some(item => item.id === destination.id)) { setDestination({ ...destination, error: 'This item is no longer available.' }); return }
      if (destination.kind === 'anchor' && value) {
        const names = useConfigStore.getState().getActivePageBlocks().flatMap(candidate => [candidate.props.anchorName, ...[1, 2, 3, 4].flatMap(number => Array.isArray(candidate.props[`section${number}Objects`]) ? (candidate.props[`section${number}Objects`] as SectionObject[]).filter(item => item.id !== destination.id || candidate.id !== block.id).map(item => item.anchorName) : [])])
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value) || names.includes(value)) { setDestination({ ...destination, error: 'Enter a unique name starting with a letter, using letters, numbers, hyphens or underscores.' }); return }
      }
      if (destination.kind === 'link' && value && !/^(https?:\/\/|\/(?!\/)|#)/i.test(value)) { setDestination({ ...destination, error: 'Use an https:// address, a page path, or an #anchor.' }); return }
      useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(item => item.id === destination.id ? { ...item, [destination.kind === 'anchor' ? 'anchorName' : 'url']: value } : item) })
      setDestination(null)
    }}>Save</button></div>
  </div>, document.body)}</>
}
