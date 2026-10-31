import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { createProjectFile, parseProjectFile, portableProjectsEnabled, readProjectZipManifest, serializeProjectFile, validateProjectMedia } from './project-file'
import { ProjectMediaLibrary } from '@/media/media-library'
import JSZip from 'jszip'
import { ProjectRevisions, type ProjectRevision } from './project-revisions'

/** Explicit portable-file commands; browser draft recovery remains separate. */
export function ProjectFileCommands({ allRevisions = false }: { allRevisions?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [opening, setOpening] = useState(false)
  const [saving, setSaving] = useState(false)
  const [revisions, setRevisions] = useState<ProjectRevision[]>([])
  const [revisionsError, setRevisionsError] = useState(false)
  const [confirmRevision, setConfirmRevision] = useState<string | null>(null)
  const [removingRevision, setRemovingRevision] = useState(false)
  const [checkingRevision, setCheckingRevision] = useState<string | null>(null)
  const navigate = useNavigate()
  const config = useConfigStore(state => state.config)
  const activeProjectId = useEditorStore(state => state.activeProjectId)
  const mediaImporting = useEditorStore(state => state.mediaImporting)
  const project = useProjectsStore(state => state.projects.find(item => item.id === activeProjectId))

  useEffect(() => {
    let active = true
    setRevisions([])
    setRevisionsError(false)
    setConfirmRevision(null)
    if (portableProjectsEnabled && (allRevisions || activeProjectId)) {
      void Promise.resolve().then(() => new ProjectRevisions().list(allRevisions ? undefined : activeProjectId!)).then(items => { if (active) setRevisions(items) })
        .catch(() => { if (active) setRevisionsError(true) })
    }
    return () => { active = false }
  }, [activeProjectId, allRevisions])

  if (!portableProjectsEnabled) return null

  async function openProject(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    try { await openProjectFile(file) } finally { input.value = '' }
  }

  async function openProjectFile(file: File) {
    if (useEditorStore.getState().mediaImporting) return
    const originalProjectId = useEditorStore.getState().activeProjectId
    const originalConfig = useConfigStore.getState().config
    setOpening(true)
    useEditorStore.getState().setMediaImporting(true)
    let stagedProjectId: string | undefined
    let createdProjectId: string | undefined
    const restoredIds: string[] = []
    let library: ProjectMediaLibrary | undefined
    try {
      if (!file.name.toLowerCase().endsWith('.zip') && file.size > 100 * 1024 * 1024) throw new Error('The project file is too large to open safely (maximum 100 MiB).')
      const zip = file.name.toLowerCase().endsWith('.zip') ? await JSZip.loadAsync(await file.arrayBuffer()) : undefined
      if (zip && Object.values(zip.files).some(entry => !entry.dir && entry.unsafeOriginalName !== entry.name)) {
        throw new Error('The project ZIP contains unsafe file paths.')
      }
      const manifest = zip?.file('project.webstudio.json')
      if (zip && !manifest) throw new Error('The project ZIP has no project.webstudio.json file.')
      const contents = manifest ? await readProjectZipManifest(manifest) : await file.text()
      const { project, migrated } = parseProjectFile(contents)
      const assetMetadata = project.assets === undefined ? [] : project.assets
      if (!Array.isArray(assetMetadata)) throw new Error('The project media list is invalid.')
      if (assetMetadata.length && !zip) throw new Error('This project references media files; open its ZIP package instead.')
      validateProjectMedia(project.config, assetMetadata)
      const projectName = typeof project.webstudioProjectName === 'string' && project.webstudioProjectName.trim()
        ? project.webstudioProjectName : project.config.name
      const id = `proj-${crypto.randomUUID()}`
      if (useProjectsStore.getState().projects.some(item => item.id === id)) throw new Error('Project identity is already in use. Try opening the project again.')
      stagedProjectId = id
      if (zip) {
        const allowedPaths = new Set(['project.webstudio.json'])
        for (const metadata of assetMetadata) {
          if (!metadata || typeof metadata !== 'object' || typeof metadata.id !== 'string' || typeof metadata.path !== 'string' || typeof metadata.name !== 'string' || typeof metadata.sha256 !== 'string' || typeof metadata.size !== 'number' || typeof metadata.mime !== 'string') {
            throw new Error('The project media list contains invalid metadata.')
          }
          if (allowedPaths.has(metadata.path)) throw new Error('The project ZIP has duplicate media paths.')
          allowedPaths.add(metadata.path)
          const entry = zip.file(metadata.path)
          if (!entry) throw new Error(`Missing project media: ${metadata.name}.`)
          const entryData = entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } }
          const expectedSize = entryData._data?.uncompressedSize
          if (!Number.isSafeInteger(expectedSize) || expectedSize !== metadata.size || metadata.size < 0 || (metadata.size > 100 * 1024 * 1024 && metadata.size > file.size * 1000)) {
            throw new Error(`Unsafe or invalid media size: ${metadata.name}.`)
          }
          const bytes = await entry.async('arraybuffer')
          library ??= new ProjectMediaLibrary()
          const restored = await library.import(id, new File([bytes], metadata.name, { type: metadata.mime }), metadata)
          restoredIds.push(restored.asset.id)
          if (restored.asset.mime !== metadata.mime || restored.asset.size !== metadata.size) throw new Error(`Invalid media type or size: ${metadata.name}.`)
        }
        if (Object.values(zip.files).some(entry => !entry.dir && !allowedPaths.has(entry.name))) throw new Error('The project ZIP contains unexpected files.')
      }
      if (useEditorStore.getState().activeProjectId !== originalProjectId || useConfigStore.getState().config !== originalConfig) {
        throw new Error('The current project changed while opening. Your edits remain in the editor; save them and open the other project again.')
      }
      useProjectsStore.getState().addProject(projectName, project, id)
      createdProjectId = id
      if (assetMetadata.length) useProjectsStore.getState().mediaChanged(id)
      useEditorStore.getState().setActiveProject(id)
      useConfigStore.getState().setConfig(project.config)
      navigate('/editor')
      toast.success(migrated ? 'Legacy project opened. Save a new WebStudio file to keep the upgrade.' : 'Project opened as a separate local copy.')
    } catch (error) {
      if (stagedProjectId) for (const id of restoredIds) await library?.remove(stagedProjectId, id).catch(() => undefined)
      if (createdProjectId) useProjectsStore.getState().deleteProject(createdProjectId)
      toast.error(error instanceof Error ? error.message : 'Project could not be opened.')
    } finally {
      setOpening(false)
      useEditorStore.getState().setMediaImporting(false)
    }
  }

  async function openRevision(revision: ProjectRevision) {
    if (checkingRevision || useEditorStore.getState().mediaImporting) return
    const originalProjectId = useEditorStore.getState().activeProjectId
    const originalConfig = useConfigStore.getState().config
    setCheckingRevision(revision.id)
    try {
      await ProjectRevisions.verify(revision)
      if (useEditorStore.getState().activeProjectId !== originalProjectId || useConfigStore.getState().config !== originalConfig) {
        throw new Error('The current project changed while checking the revision. Your edits remain; try again.')
      }
      if (useEditorStore.getState().mediaImporting) throw new Error('Wait for the current media or save operation to finish, then open the revision again.')
      await openProjectFile(new File([revision.contents], revision.filename, { type: revision.contents.type }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The local revision could not be checked.')
    } finally { setCheckingRevision(null) }
  }

  async function saveProject(checkpoint = false) {
    if (!project || useEditorStore.getState().mediaImporting) return
    setSaving(true)
    useEditorStore.getState().setMediaImporting(true)
    const preparationToast = toast.loading('Preparing project. Keep this window open until the save finishes.')
    try {
      const portableSettings = { ...project.projectFile?.settings, ...project.settings }
      delete portableSettings.deployAccessKey
      const assets = await new ProjectMediaLibrary().list(project.id)
      validateProjectMedia(config, assets)
      const previousAssets = Array.isArray(project.projectFile?.assets) ? project.projectFile.assets : []
      const projectDocument = {
        ...project.projectFile,
        ...createProjectFile(config, project.projectFile?.projectId ?? project.id),
        webstudioProjectName: project.name,
        settings: portableSettings,
        assets: assets.map(({ id, name, path, mime, size, sha256, importedAt, folder, width, height }) => ({
          ...previousAssets.find(item => item && typeof item === 'object' && item.id === id),
          id, name, path, mime, size, sha256, importedAt, folder, width, height,
        })),
      }
      const contents = serializeProjectFile(projectDocument)
      const manifestBlob = new Blob([contents], { type: 'application/json' })
      if (manifestBlob.size > 100 * 1024 * 1024) throw new Error('The project manifest exceeds the 100 MiB opening limit. Reduce project text or split the project before saving.')
      let basename = Array.from(project.name.replace(/[<>:"/\\|?*\p{Cc}]/gu, '-').trim()).slice(0, 100).join('').replace(/[. ]+$/, '') || 'site'
      if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(basename)) basename = `_${basename}`
      let download: Blob
      let filename: string
      if (assets.length) {
        const zip = new JSZip()
        zip.file('project.webstudio.json', contents)
        for (const asset of assets) {
          if (!(asset.content instanceof Blob) || asset.content.size !== asset.size || !/^[a-f0-9]{64}$/i.test(asset.sha256)) throw new Error(`Media integrity check failed for ${asset.name}. Restore or replace the file before saving.`)
          const digest = await crypto.subtle.digest('SHA-256', await asset.content.arrayBuffer())
          const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
          if (checksum !== asset.sha256.toLowerCase()) throw new Error(`Media integrity check failed for ${asset.name}. Restore or replace the file before saving.`)
          zip.file(asset.path, asset.content)
        }
        download = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
        filename = `${basename}.webstudio.zip`
      } else {
        download = manifestBlob
        filename = `${basename}.webstudio.json`
      }
      if (checkpoint) {
        const library = new ProjectRevisions()
        await library.save(project.id, filename, download)
        try {
          const items = await library.list(project.id)
          if (useEditorStore.getState().activeProjectId === project.id) { setRevisions(items); setRevisionsError(false) }
        } catch {
          if (useEditorStore.getState().activeProjectId === project.id) setRevisionsError(true)
        }
        const currentProject = useProjectsStore.getState().projects.find(item => item.id === project.id)
        if (useEditorStore.getState().activeProjectId !== project.id || useConfigStore.getState().config !== config || currentProject?.name !== project.name || JSON.stringify(currentProject?.settings ?? {}) !== JSON.stringify(project.settings ?? {})) {
          toast.warning('An earlier snapshot was saved as a local revision. Newer edits remain in the draft.')
        } else toast.success('Local revision saved. Keep a separate project file as a backup.')
        return
      }
      const url = URL.createObjectURL(download)
      const link = window.document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      useProjectsStore.getState().saveProjectFile(project.id, projectDocument)
      const currentProject = useProjectsStore.getState().projects.find(item => item.id === project.id)
      if (useEditorStore.getState().activeProjectId !== project.id || useConfigStore.getState().config !== config || currentProject?.name !== project.name || JSON.stringify(currentProject?.settings ?? {}) !== JSON.stringify(project.settings ?? {})) {
        toast.warning('An earlier snapshot was prepared. Newer changes remain in the draft; save again to include them.')
      } else toast('Project file download requested. Choose a destination if prompted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Project could not be saved.')
    } finally {
      toast.dismiss(preparationToast)
      setSaving(false)
      useEditorStore.getState().setMediaImporting(false)
    }
  }

  return (
    <div className="relative flex items-center gap-2 shrink-0">
      <input ref={inputRef} type="file" accept=".json,.zip,application/json,application/zip" className="hidden" aria-label="Choose project file" onChange={openProject} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={opening || mediaImporting}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3 disabled:opacity-50">
        <FolderOpen size={14} />{opening ? 'Opening…' : 'Open project'}
      </button>
      {project && <button type="button" disabled={mediaImporting} onClick={() => void saveProject()}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3 disabled:opacity-50">
        <Save size={14} />{saving ? 'Preparing project…' : 'Save project'}
      </button>}
      {(project || allRevisions) && <details className="text-xs">
        <summary className="cursor-pointer rounded px-2 py-1 text-text-1 hover:bg-bg-3">{allRevisions ? 'All local revisions' : 'Local revisions'}</summary>
        <div className={`absolute ${allRevisions ? 'left-0' : 'right-0'} top-full z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] max-h-80 overflow-y-auto rounded border border-border-default bg-bg-1 p-3 shadow-lg`}>
          <p className="mb-2 text-text-2">Revisions are stored on this computer. Save a separate project file for backup. Opening a revision creates a separate local project.</p>
          {!allRevisions && <button type="button" disabled={mediaImporting} onClick={() => void saveProject(true)} className="rounded px-2 py-1 text-text-1 hover:bg-bg-3 disabled:opacity-50">{saving ? 'Preparing project…' : 'Create local revision'}</button>}
          {revisionsError && <p role="alert" className="mt-2 text-text-1">Local revisions could not be read. Existing revisions were not changed.</p>}
          {!revisionsError && revisions.length === 0 && <p className="mt-2 text-text-2">No local revisions yet.</p>}
          {revisions.map(revision => <div key={revision.id} className="mt-2 border-t border-border-default pt-2">
            {allRevisions && <span className="block break-all text-text-1">{revision.filename}</span>}
            <span className="block text-text-2">{new Date(revision.createdAt).toLocaleString()}</span>
            {revision.sha256 === undefined && <span className="block text-text-2">Older revision: no checksum available.</span>}
            <button type="button" disabled={mediaImporting || !!checkingRevision} className="rounded px-2 py-1 text-text-1 hover:bg-bg-3 disabled:opacity-50" onClick={() => void openRevision(revision)}>{checkingRevision === revision.id ? 'Checking revision…' : 'Open as a separate project'}</button>
            {confirmRevision === revision.id ? <div className="mt-1">
              <p className="text-text-2">Remove this local revision? This cannot be undone.</p>
              <button type="button" disabled={removingRevision} className="rounded px-2 py-1 text-text-1 hover:bg-bg-3 disabled:opacity-50" onClick={() => {
                setRemovingRevision(true)
                void new ProjectRevisions().remove(revision.projectId, revision.id).then(() => {
                  if (allRevisions || useEditorStore.getState().activeProjectId === revision.projectId) setRevisions(current => current.filter(item => item.id !== revision.id))
                  setConfirmRevision(null)
                  toast('Local revision removed.')
                }).catch(() => toast.error('The local revision could not be removed.')).finally(() => setRemovingRevision(false))
              }}>Remove revision</button>
              <button type="button" disabled={removingRevision} className="rounded px-2 py-1 text-text-1 hover:bg-bg-3 disabled:opacity-50" onClick={() => setConfirmRevision(null)}>Cancel</button>
            </div> : <button type="button" className="rounded px-2 py-1 text-text-2 hover:bg-bg-3" onClick={() => setConfirmRevision(revision.id)}>Remove…</button>}
          </div>)}
        </div>
      </details>}
    </div>
  )
}
