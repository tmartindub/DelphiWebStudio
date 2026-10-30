import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { createProjectFile, parseProjectFile, portableProjectsEnabled, serializeProjectFile } from './project-file'
import { ProjectMediaLibrary } from '@/media/media-library'
import JSZip from 'jszip'

/** Explicit portable-file commands; browser draft recovery remains separate. */
export function ProjectFileCommands() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [opening, setOpening] = useState(false)
  const navigate = useNavigate()
  const config = useConfigStore(state => state.config)
  const activeProjectId = useEditorStore(state => state.activeProjectId)
  const mediaImporting = useEditorStore(state => state.mediaImporting)
  const project = useProjectsStore(state => state.projects.find(item => item.id === activeProjectId))

  if (!portableProjectsEnabled) return null

  async function openProject(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (useEditorStore.getState().mediaImporting) return
    setOpening(true)
    useEditorStore.getState().setMediaImporting(true)
    let createdProjectId: string | undefined
    const restoredIds: string[] = []
    const library = new ProjectMediaLibrary()
    try {
      const zip = file.name.toLowerCase().endsWith('.zip') ? await JSZip.loadAsync(await file.arrayBuffer()) : undefined
      if (zip && Object.values(zip.files).some(entry => !entry.dir && entry.unsafeOriginalName !== entry.name)) {
        throw new Error('The project ZIP contains unsafe file paths.')
      }
      const manifest = zip?.file('project.webstudio.json')
      if (zip && !manifest) throw new Error('The project ZIP has no project.webstudio.json file.')
      const manifestSize = (manifest as (JSZip.JSZipObject & { _data?: { uncompressedSize?: number } }) | null | undefined)?._data?.uncompressedSize
      if (manifest && (!Number.isSafeInteger(manifestSize) || (manifestSize! > 100 * 1024 * 1024 && manifestSize! > file.size * 1000))) throw new Error('The project ZIP manifest is too large to open safely.')
      const { project, migrated } = parseProjectFile(manifest ? await manifest.async('string') : await file.text())
      const assetMetadata = project.assets === undefined ? [] : project.assets
      if (!Array.isArray(assetMetadata)) throw new Error('The project media list is invalid.')
      if (assetMetadata.length && !zip) throw new Error('This project references media files; open its ZIP package instead.')
      const id = useProjectsStore.getState().addProject(project.config.name, project)
      createdProjectId = id
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
          const restored = await library.import(id, new File([bytes], metadata.name, { type: metadata.mime }), metadata)
          restoredIds.push(restored.asset.id)
          if (restored.asset.mime !== metadata.mime || restored.asset.size !== metadata.size) throw new Error(`Invalid media type or size: ${metadata.name}.`)
        }
        if (Object.values(zip.files).some(entry => !entry.dir && !allowedPaths.has(entry.name))) throw new Error('The project ZIP contains unexpected files.')
        if (assetMetadata.length) useProjectsStore.getState().mediaChanged(id)
      }
      useEditorStore.getState().setActiveProject(id)
      useConfigStore.getState().setConfig(project.config)
      navigate('/editor')
      toast.success(migrated ? 'Legacy project opened. Save a new WebStudio file to keep the upgrade.' : 'Project opened as a separate local copy.')
    } catch (error) {
      if (createdProjectId) {
        for (const id of restoredIds) await library.remove(createdProjectId, id).catch(() => undefined)
        useProjectsStore.getState().deleteProject(createdProjectId)
      }
      toast.error(error instanceof Error ? error.message : 'Project could not be opened.')
    } finally {
      input.value = ''
      setOpening(false)
      useEditorStore.getState().setMediaImporting(false)
    }
  }

  async function saveProject() {
    if (!project || useEditorStore.getState().mediaImporting) return
    useEditorStore.getState().setMediaImporting(true)
    try {
      const portableSettings = { ...project.projectFile?.settings, ...project.settings }
      delete portableSettings.deployAccessKey
      const assets = await new ProjectMediaLibrary().list(project.id)
      const projectDocument = {
        ...project.projectFile,
        ...createProjectFile(config, project.projectFile?.projectId ?? project.id),
        settings: portableSettings,
        assets: assets.map(({ id, name, path, mime, size, sha256, importedAt, folder, width, height }) => ({ id, name, path, mime, size, sha256, importedAt, folder, width, height })),
      }
      const contents = serializeProjectFile(projectDocument)
      const basename = project.name.replace(/[<>:"/\\|?*\p{Cc}]/gu, '-').trim().slice(0, 100) || 'site'
      let download: Blob
      let filename: string
      if (assets.length) {
        const zip = new JSZip()
        zip.file('project.webstudio.json', contents)
        for (const asset of assets) zip.file(asset.path, asset.content)
        download = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
        filename = `${basename}.webstudio.zip`
      } else {
        download = new Blob([contents], { type: 'application/json' })
        filename = `${basename}.webstudio.json`
      }
      const url = URL.createObjectURL(download)
      const link = window.document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      useProjectsStore.getState().saveProjectFile(project.id, projectDocument)
      toast.success('Project file download started.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Project could not be saved.')
    } finally {
      useEditorStore.getState().setMediaImporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <input ref={inputRef} type="file" accept=".json,.zip,application/json,application/zip" className="hidden" aria-label="Choose project file" onChange={openProject} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={opening || mediaImporting}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3 disabled:opacity-50">
        <FolderOpen size={14} />{opening ? 'Opening…' : 'Open project'}
      </button>
      {project && <button type="button" disabled={mediaImporting} onClick={() => void saveProject()}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3">
        <Save size={14} />Save project
      </button>}
    </div>
  )
}
