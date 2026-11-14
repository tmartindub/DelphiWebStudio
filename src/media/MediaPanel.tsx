import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Folder, FolderPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { ProjectMediaLibrary, type MediaAsset } from './media-library'
import { PdfPreview } from './PdfPreview'
import { useConfigStore } from '@/store/configStore'
import { getDocument } from 'pdfjs-dist'
import { requestDesktopAction } from '@/desktop/native-bridge'

function MediaThumbnail({ asset, large = false }: { asset: MediaAsset; large?: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const image = imageRef.current
    if (!image) return
    let url = ''
    let active = true
    let pdfTask: ReturnType<typeof getDocument> | undefined
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect()
        if (asset.mime === 'application/pdf') {
          void asset.content.arrayBuffer().then(async bytes => {
            if (!active) return
            pdfTask = getDocument({ data: new Uint8Array(bytes), enableXfa: false })
            pdfTask.onPassword = () => { void pdfTask?.destroy().catch(() => undefined) }
            const document = await pdfTask.promise
            const page = await document.getPage(1)
            const viewport = page.getViewport({ scale: .2 })
            const canvas = window.document.createElement('canvas')
            canvas.width = Math.ceil(viewport.width)
            canvas.height = Math.ceil(viewport.height)
            const context = canvas.getContext('2d')
            if (!context) return
            await page.render({ canvas, canvasContext: context, viewport }).promise
            if (active) image.src = canvas.toDataURL('image/png')
          }).catch(() => undefined).finally(() => { void pdfTask?.destroy().catch(() => undefined) })
        } else {
          url = URL.createObjectURL(asset.content)
          image.src = url
        }
      }
    }, { rootMargin: '150px' })
    observer.observe(image)
    return () => { active = false; observer.disconnect(); if (url) URL.revokeObjectURL(url); void pdfTask?.destroy().catch(() => undefined) }
  }, [asset])
  return <img ref={imageRef} alt="" draggable={false} className={large ? "h-28 w-full object-contain rounded bg-slate-100" : "w-12 h-12 object-cover rounded bg-bg-3"} />
}

export function MediaPanel({ picker = false, manage = false, onAdded, onSelect, accept, initialFolder = null, onFolderChange }: {
  picker?: boolean; manage?: boolean; onAdded?: () => void; onSelect?: (asset: MediaAsset) => void; accept?: string
  initialFolder?: string | null; onFolderChange?: (folder: string | null) => void
}) {
  const projectId = useEditorStore(state => state.activeProjectId)
  const mediaBusy = useEditorStore(state => state.mediaImporting)
  const pendingImport = useEditorStore(state => state.pendingMediaImport)
  const revision = useProjectsStore(state => state.projects.find(project => project.id === projectId)?.mediaRevision ?? 0)
  const projectFolders = useProjectsStore(state => state.projects.find(project => project.id === projectId)?.mediaFolders)
  const [library] = useState(() => new ProjectMediaLibrary())
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [progress, setProgress] = useState('')
  const [filter, setFilter] = useState('')
  const [fileType, setFileType] = useState(accept || 'all')
  const [selectedId, setSelectedId] = useState('')
  const [folder, setFolder] = useState(initialFolder)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [newFolder, setNewFolder] = useState<string | null>(null)
  const [moveIds, setMoveIds] = useState<string[]>([])
  const [moveDestination, setMoveDestination] = useState('')
  const [contextId, setContextId] = useState('')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState('name')
  const [allowZip, setAllowZip] = useState(false)
  const [duplicateMode, setDuplicateMode] = useState<'reuse' | 'keep' | 'skip'>('reuse')
  const [preview, setPreview] = useState<MediaAsset | null>(null)
  const [failures, setFailures] = useState<string[]>([])
  const cancel = useRef(false)
  const imageDrag = useRef<{ x: number; y: number; moved: boolean; pageId: string } | null>(null)
  const addBlock = useConfigStore(state => state.addBlock)
  const selectBlock = useEditorStore(state => state.selectBlock)
  const paths = new Set<string>()
  for (const path of [...(projectFolders ?? []), ...assets.map(asset => asset.folder)]) {
    if (!path) continue
    const parts = path.split('/')
    for (let depth = 1; depth <= parts.length; depth++) paths.add(parts.slice(0, depth).join('/'))
  }
  const folders = [...paths].sort((left, right) => {
    const a = left.split('/'), b = right.split('/')
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const order = a[i].localeCompare(b[i])
      if (order) return order
    }
    return a.length - b.length
  })
  const visibleAssets = assets.filter(asset => (folder === null || (asset.folder || '') === folder) && `${asset.folder ?? ''}/${asset.name}`.toLowerCase().includes(filter.toLowerCase()) && (fileType === 'all' || (fileType === 'documents' ? !asset.mime.startsWith('image/') && !asset.mime.startsWith('audio/') && !asset.mime.startsWith('video/') && asset.mime !== 'application/pdf' : asset.mime.startsWith(fileType))))
    .sort((a, b) => sort === 'date' ? (b.importedAt ?? 0) - (a.importedAt ?? 0) : sort === 'size' ? b.size - a.size : sort === 'type' ? a.mime.localeCompare(b.mime) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name))

  useEffect(() => {
    let active = true
    if (projectId) library.list(projectId).then(items => { if (active) setAssets(items) }).catch(error => { if (active) toast.error(String(error)) })
    return () => { active = false; cancel.current = true }
  }, [library, projectId, revision])

  async function importFiles(files: File[], resume = false, destination = folder ?? '') {
    if (!projectId || files.length === 0) return
    if (useEditorStore.getState().mediaImporting) { toast.error('Wait for the current media operation to finish.'); return }
    const previous = useEditorStore.getState().pendingMediaImport
    if (resume && (!previous || previous.projectId !== projectId)) { toast.error('Open the original project to resume this import.'); return }
    if (!resume && previous && !window.confirm('Starting a new import will discard the unfinished import list. The original files will not be changed. Continue?')) return
    const settings = resume && previous ? previous : { projectId, files, allowZip, duplicateMode, folder: destination }
    useEditorStore.getState().setMediaImporting(true)
    try {
      await requestDesktopAction('media.import', projectId)
      if (useEditorStore.getState().activeProjectId !== projectId) throw new Error('The active project changed. Import the files again.')
    } catch (error) {
      useEditorStore.getState().setMediaImporting(false)
      toast.error(error instanceof Error ? error.message : 'Media import could not start.')
      return
    }
    useEditorStore.getState().setPendingMediaImport(null)
    cancel.current = false
    let imported = 0
    let duplicates = 0
    let skipped = 0
    let nextIndex = 0
    let cancelled = false
    const errors: string[] = []
    try {
      for (let index = 0; index < files.length && !cancel.current; index++) {
        setProgress(`${index + 1} / ${files.length}: ${files[index].name}`)
        try {
          const result = await library.import(projectId, files[index], undefined, false, settings.allowZip, settings.duplicateMode, settings.folder)
          if (!result.skipped) setSelectedId(result.asset.id)
          if (result.skipped) skipped++
          else if (result.duplicate) duplicates++
          else imported++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : files[index].name)
        }
        nextIndex = index + 1
      }
      cancelled = cancel.current
      if (cancelled && nextIndex < files.length) useEditorStore.getState().setPendingMediaImport({ ...settings, files: files.slice(nextIndex) })
      useProjectsStore.getState().mediaChanged(projectId)
    } finally {
      useEditorStore.getState().setMediaImporting(false)
      setProgress('')
    }
    setFailures(errors)
    toast(`${imported} imported, ${duplicates} reused, ${skipped} skipped${cancelled ? ', cancelled' : ''}${errors.length ? `, ${errors.length} failed` : ''}`)
  }

  const selected = assets.find(asset => asset.id === selectedId)
  const pages = Math.max(1, Math.ceil(visibleAssets.length / 36)), currentPage = Math.min(page, pages - 1)
  const pageAssets = picker ? visibleAssets.slice(currentPage * 36, currentPage * 36 + 36) : visibleAssets
  function selectFolder(destination: string | null) {
    setFolder(destination)
    onFolderChange?.(destination)
    setPage(0)
    setSelectedId('')
    setSelectedIds([])
    setContextId('')
    setMoveIds([])
  }

  function selectAsset(id: string, extend = false, toggle = false) {
    setContextId('')
    if (manage) {
      const start = visibleAssets.findIndex(asset => asset.id === selectedId)
      const end = visibleAssets.findIndex(asset => asset.id === id)
      if (extend && start >= 0 && end >= 0) {
        setSelectedIds(visibleAssets.slice(Math.min(start, end), Math.max(start, end) + 1).map(asset => asset.id))
        return
      }
      setSelectedIds(ids => toggle ? (ids.includes(id) ? ids.filter(selected => selected !== id) : [...ids, id]) : [id])
    }
    setSelectedId(id)
  }

  async function moveAssets(ids: string[], destination: string) {
    if (!projectId || useEditorStore.getState().mediaImporting || useEditorStore.getState().activeProjectId !== projectId) return
    if (destination && !paths.has(destination)) { toast.error('Choose an existing media folder.'); return }
    useEditorStore.getState().setMediaImporting(true)
    try {
      await library.moveToFolder(projectId, ids, destination)
      useProjectsStore.getState().mediaChanged(projectId)
      selectFolder(destination)
      toast.success(`${ids.length} file${ids.length === 1 ? '' : 's'} moved to ${destination || 'Unfiled'}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Files could not be moved.')
    } finally {
      useEditorStore.getState().setMediaImporting(false)
    }
  }

  function beginMove(ids: string[]) {
    setContextId('')
    setMoveIds(ids)
    setMoveDestination(folder ?? '')
  }
  function addAsset(asset: MediaAsset) {
    if (!projectId || useEditorStore.getState().previewMode) { toast.error('Exit Preview to add media.'); return }
    if (accept && !asset.mime.startsWith(accept)) { toast.error('Choose a supported image.'); return }
    if (onSelect) { onSelect(asset); onAdded?.(); return }
    if (asset.mime.startsWith('image/')) {
      const editor = useEditorStore.getState(), store = useConfigStore.getState()
      const gallery = store.getActivePageBlocks().find(block => block.id === editor.selectedBlockId && block.type === 'gallery')
      if (gallery && !editor.selectedSectionObject && !editor.selectedPlacedMedia) {
        const index = store.addGalleryImages(gallery.id, [{ src: asset.path, assetId: asset.id, alt: asset.name, caption: '' }])
        editor.selectCompositeItem({ blockId: gallery.id, field: 'images', index })
      } else editor.setMediaPlacement({ projectId, pageId: store.activePageId, id: asset.id, path: asset.path, name: asset.name, width: asset.width, height: asset.height })
    } else {
      const id = `block-${crypto.randomUUID()}`
      const type = asset.mime === 'application/pdf' ? 'pdfViewer' : asset.mime.startsWith('audio/') ? 'audio' : asset.mime.startsWith('video/') ? 'mediaVideo' : 'document'
      addBlock({ id, type, variant: 'default', props: { assetId: asset.id, src: asset.path, title: asset.name, alt: asset.name } })
      selectBlock(id)
    }
    onAdded?.()
  }
  function dropFiles(event: DragEvent, destination = folder ?? '') {
      event.preventDefault()
      event.stopPropagation()
      if (!projectId || useEditorStore.getState().mediaImporting) { toast.error('Wait for the current media operation to finish.'); return }
      if (!event.dataTransfer.types.includes('Files')) return
      const entries = Array.from(event.dataTransfer.items).map(item => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => !!entry)
      const fallbackFiles = Array.from(event.dataTransfer.files)
      if (!entries.length) { if (fallbackFiles.length) void importFiles(fallbackFiles, false, destination); else toast.error('No files were found.'); return }
      const droppedProjectId = projectId
      cancel.current = false
      useEditorStore.getState().setMediaImporting(true)
      setProgress('Reading dropped files and folders…')
      void (async () => {
        const files: File[] = []
        const queue = entries.map(entry => ({ entry, folder: '' }))
        try {
          while (queue.length && !cancel.current) {
            const current = queue.shift()!
            if (current.entry.isFile) {
              const file = await new Promise<File>((resolve, reject) => (current.entry as FileSystemFileEntry).file(resolve, reject))
              if (current.folder) Object.defineProperty(file, 'webkitRelativePath', { value: `${current.folder}/${file.name}` })
              files.push(file)
            } else if (current.entry.isDirectory) {
              const folder = current.folder ? `${current.folder}/${current.entry.name}` : current.entry.name
              const reader = (current.entry as FileSystemDirectoryEntry).createReader()
              let children: FileSystemEntry[]
              do {
                children = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
                queue.push(...children.map(entry => ({ entry, folder })))
              } while (children.length && !cancel.current)
            }
          }
          if (cancel.current) { toast('Folder reading canceled; no files were imported.'); return }
          if (useEditorStore.getState().activeProjectId !== droppedProjectId) { toast.error('The project changed; drop the files again in the intended project.'); return }
          if (!files.length) { toast.error('No files were found in the dropped folders.'); return }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Dropped folders could not be read.')
          return
        } finally {
          useEditorStore.getState().setMediaImporting(false)
          setProgress('')
        }
        await importFiles(files, false, destination)
      })()
  }

  return (
    <div className={`flex min-h-0 flex-1 ${picker ? 'studio-media-picker' : ''}`}
      onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }}
      onDrop={dropFiles}>
      {picker && <aside aria-label="Media folders" className="flex w-1/4 min-w-28 max-w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-2">
        <h3 className="px-2 py-1 text-xs font-semibold text-slate-700">Folders</h3>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {[null, '', ...folders].map(destination => <button key={destination === null ? 'all-media' : `folder:${destination}`}
            type="button" title={destination || undefined} aria-pressed={folder === destination} onClick={() => selectFolder(destination)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-blue-100 ${folder === destination ? 'bg-blue-100 font-semibold' : ''}`}
            style={{ paddingInlineStart: 8 + Math.min(6, (destination?.split('/').length ?? 1) - 1) * 12 }}
            onDragOver={event => {
              if (manage && destination !== null && (event.dataTransfer.types.includes('application/x-webstudio-media-move') || event.dataTransfer.types.includes('Files'))) {
                event.preventDefault(); event.stopPropagation()
                event.dataTransfer.dropEffect = event.dataTransfer.types.includes('Files') ? 'copy' : 'move'
              }
            }}
            onDrop={event => {
              if (!manage || destination === null) return
              const payload = event.dataTransfer.getData('application/x-webstudio-media-move')
              if (payload) {
                event.preventDefault(); event.stopPropagation()
                try {
                  const { source, ids } = JSON.parse(payload)
                  if (source === projectId && Array.isArray(ids) && ids.length && ids.every(id => typeof id === 'string' && assets.some(asset => asset.id === id))) void moveAssets(ids, destination)
                } catch { toast.error('These files could not be moved.') }
              } else if (event.dataTransfer.types.includes('Files')) {
                selectFolder(destination)
                dropFiles(event, destination)
              }
            }}>
            <Folder size={16} className="shrink-0 text-blue-700" aria-hidden="true" />
            <span className="truncate">{destination === null ? 'All media' : destination === '' ? 'Unfiled' : destination.split('/').at(-1)}</span>
          </button>)}
        </div>
        {manage && (newFolder === null
          ? <button type="button" disabled={mediaBusy} onClick={() => setNewFolder('')} className="mt-2 flex items-center justify-center gap-2 rounded border border-border-default px-2 text-sm font-semibold"><FolderPlus size={16} aria-hidden="true" /> New folder</button>
          : <form className="mt-2 space-y-1 border-t border-border-default pt-2" onSubmit={event => {
            event.preventDefault()
            if (!projectId || useEditorStore.getState().mediaImporting) return
            const name = newFolder.trim()
            if (!name || name === '.' || name === '..' || /[\\/:*?"<>|\p{Cc}]/u.test(name)) { toast.error('Enter a valid folder name.'); return }
            const path = folder ? `${folder}/${name}` : name
            if (folders.some(existing => existing.toLowerCase() === path.toLowerCase())) { toast.error('A folder with that name already exists here.'); return }
            useProjectsStore.getState().addMediaFolder(projectId, path)
            setNewFolder(null)
            selectFolder(path)
          }}>
            <label className="block text-xs">Folder name <input autoFocus value={newFolder} onChange={event => setNewFolder(event.target.value)} maxLength={100} className="mt-1 w-full rounded border border-border-default bg-white px-2 py-1" /></label>
            <span className="block truncate text-xs text-slate-600" title={folder || undefined}>In {folder || 'project root'}</span>
            <div className="flex gap-2 text-xs"><button disabled={mediaBusy} className="font-semibold text-blue-700">Create folder</button><button type="button" onClick={() => setNewFolder(null)}>Cancel</button></div>
          </form>)}
      </aside>}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-4 py-3">
      <details className="shrink-0 rounded border border-border-default p-2" open={!picker || accept === 'application/pdf'}><summary className="cursor-pointer text-sm font-semibold">Import files and folders</summary><div className="mt-2 flex flex-wrap items-end gap-4"><label className="text-xs text-text-1">When files match
        <select aria-label="Duplicate files" value={duplicateMode} disabled={mediaBusy} onChange={event => setDuplicateMode(event.target.value as 'reuse' | 'keep' | 'skip')} className="ml-2 bg-bg-2 border border-border-default rounded p-1">
          <option value="reuse">Reuse existing</option><option value="keep">Keep separate copies</option><option value="skip">Skip duplicates</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-text-0">Import media{folder ? ` into ${folder}` : ''}
        <input aria-label="Import media files" type="file" accept={accept === 'application/pdf' ? '.pdf,application/pdf' : undefined} multiple onChange={event => { const input = event.currentTarget; const files = Array.from(input.files ?? []); input.value = ''; void importFiles(files) }} disabled={mediaBusy} className="block w-full mt-2 text-xs text-text-1" />
      </label>
      <label className="text-xs text-text-1">Import folder
        <input aria-label="Import media folder" type="file" {...{ webkitdirectory: '' }} multiple onChange={event => { const input = event.currentTarget; const files = Array.from(input.files ?? []); input.value = ''; void importFiles(files) }} disabled={mediaBusy} className="block w-full mt-1 text-xs" />
      </label>
      <label className="text-xs text-text-1"><input type="checkbox" checked={allowZip} onChange={event => setAllowZip(event.target.checked)} /> Allow ZIP archives</label>
      </div></details>
      {progress && <div className="text-xs text-text-1" role="status">{progress} <button type="button" onClick={() => { cancel.current = true }} className="text-green">Cancel</button></div>}
      {pendingImport && <div className="rounded border border-border-default p-2 text-xs text-text-1" role="status">
        <p>{pendingImport.files.length} files remain in an unfinished import{pendingImport.projectId !== projectId ? ' from another project' : ''}. The list is available until the app closes.</p>
        <button type="button" disabled={mediaBusy || pendingImport.projectId !== projectId} onClick={() => void importFiles(pendingImport.files, true)} className="mr-3 mt-1 text-green disabled:opacity-50">Resume import</button>
        <button type="button" disabled={mediaBusy} onClick={() => useEditorStore.getState().setPendingMediaImport(null)} className="mt-1 text-text-2">Discard list</button>
      </div>}
      <div className="flex flex-wrap gap-2"><input aria-label="Search media" value={filter} onChange={event => { setFilter(event.target.value); setPage(0); setSelectedId(''); setSelectedIds([]); setContextId(''); setMoveIds([]) }} placeholder={folder === null ? 'Search all media...' : 'Search this folder...'} className="min-w-28 flex-1 px-2 py-1.5 rounded bg-bg-2 border border-border-default text-xs" />
      <div className="flex gap-1">
        <select aria-label="Filter media by type" value={fileType} onChange={event => { setFileType(event.target.value); setPage(0); setSelectedId(''); setSelectedIds([]); setContextId(''); setMoveIds([]) }} className="min-w-0 flex-1 bg-bg-2 border border-border-default rounded text-xs p-1">
          <option value="all">All types</option><option value="image/">Images</option><option value="application/pdf">PDFs</option><option value="audio/">Audio</option><option value="video/">Video</option><option value="documents">Other documents</option>
        </select>
        <select aria-label="Sort media" value={sort} onChange={event => setSort(event.target.value)} className="min-w-0 flex-1 bg-bg-2 border border-border-default rounded text-xs p-1">
          <option value="name">Name</option><option value="date">Date</option><option value="size">Size</option><option value="type">Type</option>
        </select>
      </div>
      </div>{manage && <div className="flex flex-wrap gap-3 text-xs">
        <button type="button" disabled={mediaBusy || !selectedIds.length} onClick={() => beginMove(selectedIds)} className="font-semibold text-blue-700">Move to folder…</button>
        <button type="button" disabled={mediaBusy || !visibleAssets.length} onClick={() => {
          if (!projectId) return
          const prefix = window.prompt(`Rename ${visibleAssets.length} shown files. Enter a prefix:`)?.trim()
          if (!prefix) return
          const changes = visibleAssets.map((asset, index) => ({ id: asset.id, name: `${prefix}-${index + 1}.${asset.name.split('.').pop()}` }))
          if (!window.confirm(`Rename ${changes.length} files? First: ${changes[0].name}`)) return
          useEditorStore.getState().setMediaImporting(true)
          void library.rename(projectId, changes).then(() => { useProjectsStore.getState().mediaChanged(projectId); toast('Media renamed') }).catch(error => toast.error(String(error))).finally(() => useEditorStore.getState().setMediaImporting(false))
        }} className="text-green disabled:opacity-50">Rename shown…</button>
        {assets.some(asset => asset.previousName) && <button type="button" disabled={mediaBusy} onClick={() => {
          if (!projectId || !window.confirm('Undo all available media renames in this project?')) return
          useEditorStore.getState().setMediaImporting(true)
          void library.undoRenames(projectId, assets.filter(asset => asset.previousName).map(asset => asset.id)).then(() => { useProjectsStore.getState().mediaChanged(projectId); toast('Media renames undone') }).catch(error => toast.error(String(error))).finally(() => useEditorStore.getState().setMediaImporting(false))
        }} className="text-green">Undo renames</button>}
      </div>}
      {manage && !!moveIds.length && <form aria-label="Move selected media" className="flex flex-wrap items-end gap-3 rounded border border-border-default bg-slate-50 p-2 text-sm" onSubmit={event => { event.preventDefault(); void moveAssets(moveIds, moveDestination) }}>
        <label className="flex flex-col gap-1">Move {moveIds.length} file{moveIds.length === 1 ? '' : 's'} to
          <select autoFocus aria-label="Destination folder" value={moveDestination} onChange={event => setMoveDestination(event.target.value)} className="max-w-56 rounded border border-border-default bg-white p-1">
            <option value="">Unfiled</option>
            {folders.map(path => <option key={path} value={path}>{path}</option>)}
          </select>
        </label>
        <button disabled={mediaBusy} className="rounded bg-blue-700 px-3 text-white">Move</button>
        <button type="button" onClick={() => setMoveIds([])}>Cancel</button>
      </form>}
      {failures.length > 0 && <details className="text-xs text-status-red"><summary>{failures.length} files could not be imported</summary><ul>{failures.map((error, index) => <li key={index}>{error}</li>)}</ul></details>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="min-w-0 break-words">{folder === null ? 'All media' : folder || 'Unfiled'} · {visibleAssets.length} files{manage ? ` · ${selectedIds.length} selected` : selected ? ` · Selected: ${selected.name}` : ''}</span>{picker && pages > 1 && <div className="flex items-center gap-2"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>}</div>
      <div className={picker ? "grid flex-1 min-h-0 content-start grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] gap-3 overflow-y-auto p-1" : "overflow-y-auto flex-1 space-y-1"}>
        {pageAssets.map(asset => (
          <div key={asset.id} role={picker ? 'button' : undefined} tabIndex={picker ? 0 : undefined}
            aria-pressed={picker ? (manage ? selectedIds.includes(asset.id) : selectedId === asset.id) : undefined}
            aria-label={picker ? `Select ${asset.name}` : undefined}
            onClick={event => { if (event.target instanceof Element && event.target.closest('button,label')) return; selectAsset(asset.id, event.shiftKey, event.ctrlKey || event.metaKey) }}
            onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectAsset(asset.id, event.shiftKey, event.ctrlKey || event.metaKey) } }}
            onContextMenu={manage ? event => {
              event.preventDefault()
              if (!selectedIds.includes(asset.id)) selectAsset(asset.id)
              setContextId(asset.id)
            } : undefined}
            draggable={manage || !asset.mime.startsWith('image/')} onDragStart={event => {
              if (manage) {
                if (mediaBusy) { event.preventDefault(); return }
                const ids = selectedIds.includes(asset.id) ? selectedIds : [asset.id]
                if (!selectedIds.includes(asset.id)) selectAsset(asset.id)
                event.dataTransfer.setData('application/x-webstudio-media-move', JSON.stringify({ source: projectId, ids }))
                event.dataTransfer.effectAllowed = 'move'
              } else {
                event.dataTransfer.setData('application/x-webstudio-asset', asset.id)
                event.dataTransfer.effectAllowed = 'copy'
              }
            }} onPointerDown={event => {
            if (picker || !asset.mime.startsWith('image/') || event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return
            imageDrag.current = { x: event.clientX, y: event.clientY, moved: false, pageId: useConfigStore.getState().activePageId }
            event.currentTarget.setPointerCapture(event.pointerId)
          }} onPointerMove={event => {
            const drag = imageDrag.current
            if (drag && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true
          }} onPointerCancel={() => { imageDrag.current = null }} onPointerUp={event => {
            const drag = imageDrag.current
            imageDrag.current = null
            if (!drag?.moved || !projectId || useEditorStore.getState().activeProjectId !== projectId || useEditorStore.getState().previewMode || useConfigStore.getState().activePageId !== drag.pageId) return
            const element = document.elementFromPoint(event.clientX, event.clientY)
            const section = element?.closest<HTMLElement>('[data-editor-section]')
            const number = Number(section?.dataset.editorSection)
            const blockElement = element?.closest<HTMLElement>('[data-webstudio-block-id]')
            const blockId = blockElement?.getAttribute('data-webstudio-block-id')
            const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === blockId)
            if (block?.type === 'gallery' && (!section || number === 1) && !element?.closest('[data-ws-object-type="panel"],[data-ws-parented="true"]')) {
              const index = useConfigStore.getState().addGalleryImages(block.id, [{ src: asset.path, assetId: asset.id, alt: asset.name, caption: '' }])
              useEditorStore.getState().selectBlock(block.id)
              useEditorStore.getState().selectCompositeItem({ blockId: block.id, field: 'images', index })
              return
            }
            if (section && block && number >= 1 && number <= 4) {
              const bounds = section.getBoundingClientRect()
              if (!bounds.width) return
              const key = `section${number}Objects`, items = Array.isArray(block.props[key]) ? block.props[key] : []
              const width = 30, x = Math.max(0, Math.min(100 - width, (event.clientX - bounds.left) / bounds.width * 100))
              const height = asset.width && asset.height ? Math.max(24, bounds.width * width / 100 * asset.height / asset.width) : 180
              useConfigStore.getState().updateBlockProps(block.id, { [key]: [...items, { id: `object-${crypto.randomUUID()}`, type: 'image', src: asset.path, assetId: asset.id, alt: asset.name, x, y: Math.max(0, event.clientY - bounds.top), width, height, layer: items.length + 1 }] })
              useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(number)
              toast(`Image added to section ${number}`)
            } else if (block && blockElement) {
              const bounds = blockElement.getBoundingClientRect()
              if (!bounds.width || !bounds.height) return
              const x = Math.max(0, Math.min(99, (event.clientX - bounds.left) / bounds.width * 100)), y = Math.max(0, Math.min(99, (event.clientY - bounds.top) / bounds.height * 100))
              const items = Array.isArray(block.props.placedMedia) ? block.props.placedMedia : []
              useConfigStore.getState().updateBlockProps(block.id, { placedMedia: [...items, { id: `placed-${crypto.randomUUID()}`, assetId: asset.id, src: asset.path, name: asset.name, mime: asset.mime, x, y, width: Math.max(1, Math.min(25, 100 - x)) }] })
              useEditorStore.getState().selectBlock(block.id)
            } else if (element?.closest('[aria-label^="Site preview,"]')) {
              const id = `block-${crypto.randomUUID()}`
              useConfigStore.getState().addBlock({ id, type: 'image', variant: 'hero-image', props: { assetId: asset.id, src: asset.path, alt: asset.name, layoutWidth: 40 } })
              useEditorStore.getState().selectBlock(id)
            }
          }} className={`relative rounded border p-2 text-xs text-text-1 break-all ${(manage ? selectedIds.includes(asset.id) : selectedId === asset.id) ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50' : 'border-border-default'}`}>
            {(asset.mime.startsWith('image/') || asset.mime === 'application/pdf') && <MediaThumbnail asset={asset} large={picker} />}
            {!asset.mime.startsWith('image/') && asset.mime !== 'application/pdf' && <div className="grid h-28 place-items-center rounded bg-slate-100 text-2xl text-slate-600" aria-hidden="true">{asset.mime.startsWith('video/') ? '▶ Video' : asset.mime.startsWith('audio/') ? '♫ Audio' : '▤ File'}</div>}
            <div className="mt-2 font-semibold">{asset.name}</div><div className="text-text-3">{asset.folder && `${asset.folder} · `}{asset.mime} · {(asset.size / 1024).toFixed(1)} KB{asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}</div>
            {asset.mime === 'application/pdf' && <button type="button" onClick={() => setPreview(asset)} className="text-green mt-1">Preview PDF</button>}
            {!picker && <button type="button" onClick={() => addAsset(asset)} className="text-green mt-1 ml-2">Add to page</button>}
            {manage && contextId === asset.id && <div role="menu" aria-label={`Actions for ${asset.name}`} className="absolute inset-x-2 bottom-2 z-10 rounded border border-slate-400 bg-white p-1 shadow-lg"
              onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.parentElement?.focus(); setContextId('') } }}>
              <button type="button" role="menuitem" autoFocus disabled={mediaBusy} onClick={() => beginMove(selectedIds.includes(asset.id) ? selectedIds : [asset.id])} className="w-full rounded px-2 text-left hover:bg-blue-100">Move to folder…</button>
            </div>}
            {manage && <label className="text-green mt-1 ml-2 cursor-pointer">Replace
              <input type="file" aria-label={`Replace ${asset.name}`} className="hidden" disabled={mediaBusy} onChange={event => {
                const input = event.currentTarget
                const file = input.files?.[0]
                input.value = ''
                if (!file || !projectId || useEditorStore.getState().mediaImporting) return
                useEditorStore.getState().setMediaImporting(true)
                void file.arrayBuffer().then(async bytes => {
                  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('')
                  await library.import(projectId, new File([bytes], asset.name, { type: asset.mime }), { id: asset.id, path: asset.path, sha256, importedAt: asset.importedAt, folder: asset.folder }, true)
                  useProjectsStore.getState().mediaChanged(projectId)
                  toast.success('Media replaced; page references were preserved.')
                }).catch(error => toast.error(error instanceof Error ? error.message : 'Replacement failed.')).finally(() => useEditorStore.getState().setMediaImporting(false))
              }} />
            </label>}
            {manage && asset.previousVersion && <button type="button" disabled={mediaBusy} onClick={() => {
              if (!projectId) return
              useEditorStore.getState().setMediaImporting(true)
              void library.undoReplacement(projectId, asset.id).then(() => { useProjectsStore.getState().mediaChanged(projectId); toast('Replacement undone') }).catch(error => toast.error(String(error))).finally(() => useEditorStore.getState().setMediaImporting(false))
            }} className="text-green mt-1 ml-2">Undo replacement</button>}
          </div>
        ))}
        {visibleAssets.length === 0 && <p className="col-span-full text-xs text-text-3">{assets.length === 0 ? 'No media imported yet.' : 'No matching files in this view.'}</p>}
      </div>
      {picker && !manage && <footer className="flex shrink-0 items-center justify-between border-t border-border-default pt-3"><span className="text-sm text-text-2">{selected ? `${selected.name} · ${(selected.size / 1024).toFixed(1)} KB${selected.width ? ` · ${selected.width}×${selected.height}` : ''}` : 'Select a file above.'}</span><button type="button" disabled={!selected || mediaBusy || (!!accept && !selected.mime.startsWith(accept))} className="rounded bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-40" onClick={() => selected && addAsset(selected)}>{onSelect ? 'Choose file' : 'Add to page'}</button></footer>}
      {preview && <PdfPreview asset={preview} onClose={() => setPreview(null)} />}
      </div>
    </div>
  )
}
