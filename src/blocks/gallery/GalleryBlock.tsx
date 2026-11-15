import { ImageIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BlockConfig } from '../types'
import { connectGalleryViewer } from './gallery-viewer.js'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { toast } from 'sonner'
import type { MediaAsset } from '@/media/media-library'
import { normalizeGalleryBlock, type GalleryPhoto } from './gallery-photos'

function ImageCard({ image, tall, responsive, viewer }: { image: GalleryPhoto; tall?: boolean; responsive: boolean; viewer: boolean }) {
  const canEnlarge = viewer && !!image.src
  const thumbnail = image.exportThumbnail
  return (
    <div className={`relative rounded-lg overflow-hidden border border-border-default group ${tall ? 'row-span-2' : ''}`}>
      {image.src ? (
        <img src={thumbnail?.src || image.src} alt={image.alt || ''}
          className={`${responsive ? 'block h-auto w-auto max-h-[clamp(150px,26cqw,220px)] max-w-full object-contain' : 'w-full h-full object-cover'}${canEnlarge ? ' cursor-zoom-in touch-manipulation focus-visible:outline-2 focus-visible:-outline-offset-2' : ''}`}
          width={thumbnail?.width}
          height={thumbnail?.height}
          style={responsive && thumbnail ? { width: `calc(clamp(150px,26cqw,220px) * ${thumbnail.width / thumbnail.height})`, aspectRatio: `${thumbnail.width} / ${thumbnail.height}` } : undefined}
          loading={thumbnail ? 'lazy' : undefined}
          decoding={responsive || thumbnail ? 'async' : undefined}
          draggable={responsive || canEnlarge ? false : undefined}
          role={canEnlarge ? 'button' : undefined}
          tabIndex={canEnlarge ? 0 : undefined}
          aria-haspopup={canEnlarge ? 'dialog' : undefined}
          aria-label={canEnlarge ? (image.alt ? `Enlarge ${image.alt}` : 'Enlarge photo') : undefined}
          data-ws-gallery-thumbnail={canEnlarge ? true : undefined}
          data-ws-gallery-original={canEnlarge && thumbnail ? image.src : undefined}
          data-ws-gallery-caption={canEnlarge ? image.caption : undefined}
        />
      ) : (
        <div className={`${responsive ? 'w-40 max-w-full' : 'w-full'} h-full min-h-[140px] bg-gradient-to-br from-bg-3 to-bg-4 flex items-center justify-center`}>
          <ImageIcon size={24} className="text-text-3" />
        </div>
      )}
      {image.caption && !canEnlarge && (
        <div className={`${responsive ? 'w-0 min-w-full [overflow-wrap:anywhere] ' : ''}px-3 py-2 bg-bg-2 text-[11px] text-text-2`}>{image.caption}</div>
      )}
    </div>
  )
}

export function GalleryBlock({ block, editable = false }: { block: BlockConfig; editable?: boolean }) {
  const { variant, props } = normalizeGalleryBlock(block)
  const title = props.title as string | undefined
  const viewer = props.enablePhotoViewer === true
  const gallery = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const selection = useEditorStore(state => state.selectedCompositeItem)
  useEffect(() => {
    if (viewer && gallery.current) return connectGalleryViewer(gallery.current)
  }, [viewer])
  const images = props.images as GalleryPhoto[]
  const selectedId = selection?.blockId === block.id && selection.field === 'images' ? selection.id ?? images[selection.index]?.id : undefined

  function selectPhoto(id: string) {
    const current = useConfigStore.getState().getActivePageBlocks().find(item => item.id === block.id)
    const photos = current?.props.images as GalleryPhoto[] | undefined
    const index = photos?.findIndex(photo => photo.id === id) ?? -1
    if (index < 0) return
    const editor = useEditorStore.getState()
    editor.selectBlock(block.id); editor.selectCompositeItem({ blockId: block.id, field: 'images', index, id }); editor.selectImage(index)
    gallery.current?.querySelector<HTMLElement>(`[data-ws-gallery-photo-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true })
  }

  function editPhoto(id: string, operation: 'move' | 'duplicate' | 'remove', position?: number) {
    const current = useConfigStore.getState().getActivePageBlocks().find(item => item.id === block.id)
    const photos = current?.props.images as GalleryPhoto[] | undefined
    const index = photos?.findIndex(photo => photo.id === id) ?? -1
    if (index < 0) return
    selectPhoto(id)
    try { useConfigStore.getState().editBlockItems(block.id, 'images', index, position === undefined ? index : position - 1, operation) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'The photo could not be changed.') }
    setMenu(null)
  }

  function properties(id: string, position = false) {
    selectPhoto(id); setMenu(null)
    window.dispatchEvent(new Event('webstudio.properties'))
    if (position) requestAnimationFrame(() => {
      const field = document.querySelector<HTMLInputElement>('#editor-right-panel input[name="position"]')
      field?.focus(); field?.select()
    })
  }

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return
    const element = menuRef.current, bounds = element.getBoundingClientRect()
    element.style.left = `${Math.max(0, Math.min(menu.x, window.innerWidth - bounds.width))}px`
    element.style.top = `${Math.max(0, Math.min(menu.y, window.innerHeight - bounds.height))}px`
    element.querySelector<HTMLButtonElement>('button')?.focus()
  }, [menu])
  useEffect(() => {
    if (!menu) return
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [menu])

  const masonry = variant === 'masonry'
  const responsive = variant === 'responsive'
  return (
    <div ref={gallery} data-ws-gallery-viewer={viewer ? true : undefined} className="relative px-6 py-12 @lg:px-16 @lg:py-16" onKeyDown={event => {
      if (!editable || event.key !== 'Delete' || !selectedId || (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"],[data-ws-gallery-dialog]'))) return
      event.preventDefault(); event.stopPropagation(); editPhoto(selectedId, 'remove')
    }}>
      {title && <h2 className="reveal-fade-up reveal-d1 text-2xl font-display font-semibold mb-6 text-center">{title}</h2>}
      {editable && <div className="absolute right-6 top-2 z-20 flex flex-wrap gap-2" data-gallery-tools>
        <button type="button" className="rounded border border-slate-400 bg-white px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-100" onClick={() => {
          const projectId = useEditorStore.getState().activeProjectId, pageId = useConfigStore.getState().activePageId
          window.dispatchEvent(new CustomEvent('webstudio.media', { detail: { accept: 'image/', onSelect: (asset: MediaAsset) => {
            if (useEditorStore.getState().activeProjectId !== projectId || useConfigStore.getState().activePageId !== pageId) { toast.error('The project or page changed. Select the gallery again.'); return }
            try {
              const index = useConfigStore.getState().addGalleryImages(block.id, [{ src: asset.path, assetId: asset.id, alt: asset.name, caption: '' }])
              useEditorStore.getState().selectBlock(block.id)
              useEditorStore.getState().selectCompositeItem({ blockId: block.id, field: 'images', index })
            } catch (error) { toast.error(error instanceof Error ? error.message : 'The photo could not be added.') }
          } } }))
        }}>Add photos</button>
      </div>}
      {!images.length && <p className="rounded border border-dashed border-slate-400 p-8 text-center text-sm text-text-2">{editable ? 'This gallery is empty. Choose Add photos or drop photos here.' : 'No photos have been added yet.'}</p>}
      <div className={responsive ? 'flex flex-wrap items-start gap-3' : `grid grid-cols-2 @lg:grid-cols-3 gap-3${masonry ? ' auto-rows-[160px]' : ''}`}>
        {images.map((img, i) => (
          <div key={img.id} data-ws-item-field="images" data-ws-item-index={i} data-ws-gallery-photo-id={editable ? img.id : undefined}
            tabIndex={editable ? 0 : undefined} aria-label={editable ? `Photo ${i + 1}: ${img.alt || 'Untitled photo'}` : undefined}
            style={editable && selectedId === img.id ? { outline: '2px solid #005a9e', outlineOffset: 2 } : undefined}
            draggable={editable}
            onPointerDown={event => { if (editable) event.stopPropagation() }}
            onClick={event => { if (editable) { event.stopPropagation(); selectPhoto(img.id) } }}
            onContextMenu={event => { if (editable) { event.preventDefault(); event.stopPropagation(); selectPhoto(img.id); setMenu({ id: img.id, x: event.clientX, y: event.clientY }) } }}
            onDragStart={event => { if (editable) { event.stopPropagation(); selectPhoto(img.id); event.dataTransfer.setData('application/x-webstudio-gallery-photo', JSON.stringify({ blockId: block.id, id: img.id })); event.dataTransfer.effectAllowed = 'move' } }}
            onDragOver={event => { if (editable && event.dataTransfer.types.includes('application/x-webstudio-gallery-photo')) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move' } }}
            onDrop={event => {
              const value = event.dataTransfer.getData('application/x-webstudio-gallery-photo')
              if (!editable || !value) return
              event.preventDefault(); event.stopPropagation()
              try { const source = JSON.parse(value); if (source.blockId === block.id && source.id !== img.id) editPhoto(source.id, 'move', i + 1) }
              catch { toast.error('The photo could not be moved.') }
            }}
            className={`relative ${responsive ? 'min-w-0 max-w-full [&[draggable=true]]:cursor-grab [&[draggable=true]:active]:cursor-grabbing' : `reveal-scale reveal-d${Math.min(i + 2, 8)}`}`}>
            <ImageCard image={img} responsive={responsive} tall={masonry && i % 3 === 0} viewer={viewer} />
            {editable && <span data-gallery-position={i + 1} aria-label={`Photo position ${i + 1}`} className="pointer-events-none absolute left-1.5 top-1.5 z-10 rounded border border-slate-400 bg-white/95 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-800 shadow-sm">{i + 1}</span>}
          </div>
        ))}
      </div>
      {editable && menu && createPortal(<div ref={menuRef} role="menu" aria-label="Photo actions" className="fixed z-[10001] w-48 rounded border border-gray-400 bg-white p-1 text-sm text-black shadow-lg" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMenu(null); selectPhoto(menu.id) }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus() }
      }}>
        <button type="button" role="menuitem" className="block w-full rounded px-3 py-1.5 text-left hover:bg-blue-100" onClick={() => properties(menu.id)}>Properties</button>
        <button type="button" role="menuitem" className="block w-full rounded px-3 py-1.5 text-left hover:bg-blue-100" onClick={() => properties(menu.id, true)}>Move to position</button>
        <button type="button" role="menuitem" className="block w-full rounded px-3 py-1.5 text-left hover:bg-blue-100" onClick={() => editPhoto(menu.id, 'duplicate')}>Duplicate</button>
        <button type="button" role="menuitem" className="block w-full rounded px-3 py-1.5 text-left hover:bg-blue-100" onClick={() => editPhoto(menu.id, 'remove')}>Delete</button>
      </div>, document.body)}
      {viewer && <dialog data-ws-gallery-dialog aria-label="Enlarged photo"
        className="@container m-auto max-h-[92dvh] w-[min(94vw,94cqw,72rem)] max-w-none overflow-auto rounded-xl border border-slate-300 bg-white text-slate-900 shadow-2xl backdrop:bg-slate-950/75 [color-scheme:light]">
        <form method="dialog" className="sticky top-0 z-10 flex justify-end border-b border-slate-200 bg-white px-3 py-2">
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100">Close photo</button>
        </form>
        <figure className="grid gap-4 p-3 @min-[40rem]:data-[caption=true]:grid-cols-[minmax(0,1fr)_minmax(12rem,27%)] @min-[40rem]:p-4">
          <div className="flex min-w-0 items-center justify-center rounded-md bg-slate-100">
            <img data-ws-gallery-expanded alt="" className="block h-auto max-h-[70dvh] w-auto max-w-full object-contain" />
          </div>
          <figcaption hidden className="self-center whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-[22px] leading-relaxed [overflow-wrap:anywhere]" />
        </figure>
      </dialog>}
    </div>
  )
}
