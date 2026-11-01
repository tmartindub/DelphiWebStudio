import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { ProjectMediaLibrary, type MediaAsset } from './media-library'
import { PdfPreview } from './PdfPreview'
import { useConfigStore } from '@/store/configStore'
import { getDocument } from 'pdfjs-dist'

function MediaThumbnail({ asset }: { asset: MediaAsset }) {
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
  return <img ref={imageRef} alt="" className="w-12 h-12 object-cover rounded bg-bg-3" />
}

export function MediaPanel() {
  const projectId = useEditorStore(state => state.activeProjectId)
  const mediaBusy = useEditorStore(state => state.mediaImporting)
  const pendingImport = useEditorStore(state => state.pendingMediaImport)
  const revision = useProjectsStore(state => state.projects.find(project => project.id === projectId)?.mediaRevision ?? 0)
  const [library] = useState(() => new ProjectMediaLibrary())
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [progress, setProgress] = useState('')
  const [filter, setFilter] = useState('')
  const [fileType, setFileType] = useState('all')
  const [sort, setSort] = useState('name')
  const [allowZip, setAllowZip] = useState(false)
  const [duplicateMode, setDuplicateMode] = useState<'reuse' | 'keep' | 'skip'>('reuse')
  const [preview, setPreview] = useState<MediaAsset | null>(null)
  const [failures, setFailures] = useState<string[]>([])
  const cancel = useRef(false)
  const addBlock = useConfigStore(state => state.addBlock)
  const selectBlock = useEditorStore(state => state.selectBlock)
  const visibleAssets = assets.filter(asset => `${asset.folder ?? ''}/${asset.name}`.toLowerCase().includes(filter.toLowerCase()) && (fileType === 'all' || (fileType === 'documents' ? !asset.mime.startsWith('image/') && !asset.mime.startsWith('audio/') && !asset.mime.startsWith('video/') && asset.mime !== 'application/pdf' : asset.mime.startsWith(fileType))))
    .sort((a, b) => sort === 'date' ? (b.importedAt ?? 0) - (a.importedAt ?? 0) : sort === 'size' ? b.size - a.size : sort === 'type' ? a.mime.localeCompare(b.mime) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name))

  useEffect(() => {
    let active = true
    if (projectId) library.list(projectId).then(items => { if (active) setAssets(items) }).catch(error => { if (active) toast.error(String(error)) })
    return () => { active = false; cancel.current = true }
  }, [library, projectId, revision])

  async function importFiles(files: File[], resume = false) {
    if (!projectId || files.length === 0) return
    if (useEditorStore.getState().mediaImporting) { toast.error('Wait for the current media operation to finish.'); return }
    const previous = useEditorStore.getState().pendingMediaImport
    if (resume && (!previous || previous.projectId !== projectId)) { toast.error('Open the original project to resume this import.'); return }
    if (!resume && previous && !window.confirm('Starting a new import will discard the unfinished import list. The original files will not be changed. Continue?')) return
    const settings = resume && previous ? previous : { projectId, files, allowZip, duplicateMode }
    useEditorStore.getState().setPendingMediaImport(null)
    useEditorStore.getState().setMediaImporting(true)
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
          const result = await library.import(projectId, files[index], undefined, false, settings.allowZip, settings.duplicateMode)
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

  return (
    <div className="flex flex-col flex-1 min-h-0 px-3 py-3 gap-2" onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault()
      const files = Array.from(event.dataTransfer.files)
      if (files.length) void importFiles(files)
      else toast.error('Drop files; folder import is not available yet.')
    }}>
      <label className="text-xs text-text-1">When files match
        <select aria-label="Duplicate files" value={duplicateMode} disabled={mediaBusy} onChange={event => setDuplicateMode(event.target.value as 'reuse' | 'keep' | 'skip')} className="ml-2 bg-bg-2 border border-border-default rounded p-1">
          <option value="reuse">Reuse existing</option><option value="keep">Keep separate copies</option><option value="skip">Skip duplicates</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-text-0">Import media
        <input aria-label="Import media files" type="file" multiple onChange={event => { const input = event.currentTarget; const files = Array.from(input.files ?? []); input.value = ''; void importFiles(files) }} disabled={mediaBusy} className="block w-full mt-2 text-xs text-text-1" />
      </label>
      <label className="text-xs text-text-1">Import folder
        <input aria-label="Import media folder" type="file" {...{ webkitdirectory: '' }} multiple onChange={event => { const input = event.currentTarget; const files = Array.from(input.files ?? []); input.value = ''; void importFiles(files) }} disabled={mediaBusy} className="block w-full mt-1 text-xs" />
      </label>
      <label className="text-xs text-text-1"><input type="checkbox" checked={allowZip} onChange={event => setAllowZip(event.target.checked)} /> Allow ZIP archives</label>
      {progress && <div className="text-xs text-text-1" role="status">{progress} <button type="button" onClick={() => { cancel.current = true }} className="text-green">Cancel</button></div>}
      {pendingImport && <div className="rounded border border-border-default p-2 text-xs text-text-1" role="status">
        <p>{pendingImport.files.length} files remain in an unfinished import{pendingImport.projectId !== projectId ? ' from another project' : ''}. The list is available until the app closes.</p>
        <button type="button" disabled={mediaBusy || pendingImport.projectId !== projectId} onClick={() => void importFiles(pendingImport.files, true)} className="mr-3 mt-1 text-green disabled:opacity-50">Resume import</button>
        <button type="button" disabled={mediaBusy} onClick={() => useEditorStore.getState().setPendingMediaImport(null)} className="mt-1 text-text-2">Discard list</button>
      </div>}
      <input aria-label="Search media" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search media..." className="w-full px-2 py-1.5 rounded bg-bg-2 border border-border-default text-xs" />
      <div className="flex gap-1">
        <select aria-label="Filter media by type" value={fileType} onChange={event => setFileType(event.target.value)} className="min-w-0 flex-1 bg-bg-2 border border-border-default rounded text-xs p-1">
          <option value="all">All types</option><option value="image/">Images</option><option value="application/pdf">PDFs</option><option value="audio/">Audio</option><option value="video/">Video</option><option value="documents">Other documents</option>
        </select>
        <select aria-label="Sort media" value={sort} onChange={event => setSort(event.target.value)} className="min-w-0 flex-1 bg-bg-2 border border-border-default rounded text-xs p-1">
          <option value="name">Name</option><option value="date">Date</option><option value="size">Size</option><option value="type">Type</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
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
      </div>
      <p className="text-[11px] text-text-2">Media is stored in this browser and included when you save the project ZIP.</p>
      {failures.length > 0 && <details className="text-xs text-status-red"><summary>{failures.length} files could not be imported</summary><ul>{failures.map((error, index) => <li key={index}>{error}</li>)}</ul></details>}
      <div className="overflow-y-auto flex-1 space-y-1">
        {visibleAssets.map(asset => (
          <div key={asset.id} draggable onDragStart={event => { event.dataTransfer.setData('application/x-webstudio-asset', asset.id); event.dataTransfer.effectAllowed = 'copy' }} className="rounded border border-border-default p-2 text-xs text-text-1 break-all">
            {(asset.mime.startsWith('image/') || asset.mime === 'application/pdf') && <MediaThumbnail asset={asset} />}
            <div>{asset.name}</div><div className="text-text-3">{asset.folder && `${asset.folder} · `}{asset.mime} · {(asset.size / 1024).toFixed(1)} KB{asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}</div>
            {asset.mime === 'application/pdf' && <button type="button" onClick={() => setPreview(asset)} className="text-green mt-1">Preview PDF</button>}
            <button type="button" onClick={() => {
              const id = `block-${crypto.randomUUID()}`
              const type = asset.mime === 'application/pdf' ? 'pdfViewer' : asset.mime.startsWith('image/') ? 'image' : asset.mime.startsWith('audio/') ? 'audio' : asset.mime.startsWith('video/') ? 'mediaVideo' : 'document'
              addBlock({ id, type, variant: type === 'image' ? 'hero-image' : 'default', props: { assetId: asset.id, src: asset.path, title: asset.name, alt: asset.name } })
              selectBlock(id)
              toast('Added to page')
            }} className="text-green mt-1 ml-2">Add to page</button>
            <label className="text-green mt-1 ml-2 cursor-pointer">Replace
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
            </label>
            {asset.previousVersion && <button type="button" disabled={mediaBusy} onClick={() => {
              if (!projectId) return
              useEditorStore.getState().setMediaImporting(true)
              void library.undoReplacement(projectId, asset.id).then(() => { useProjectsStore.getState().mediaChanged(projectId); toast('Replacement undone') }).catch(error => toast.error(String(error))).finally(() => useEditorStore.getState().setMediaImporting(false))
            }} className="text-green mt-1 ml-2">Undo replacement</button>}
          </div>
        ))}
        {assets.length === 0 && <p className="text-xs text-text-3">No media imported yet.</p>}
      </div>
      {preview && <PdfPreview asset={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
