import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Save } from 'lucide-react'
import { toast } from 'sonner'
import { configDraftReadFailed, useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { projectDraftReadFailed, useProjectsStore } from '@/store/projectsStore'
import { createProjectFile, decodeProjectFile, parseProjectFile, portableProjectsEnabled, readProjectZipManifest, serializeProjectFile, validateProjectMedia } from './project-file'
import { ProjectMediaLibrary } from '@/media/media-library'
import JSZip from 'jszip'
import { ProjectRevisions, type ProjectRevision } from './project-revisions'
import { requestDesktopAction } from '@/desktop/native-bridge'
import { importWordPressXml } from './wordpress-import'
import { importStaticHtml } from './static-html-import'

/** Explicit portable-file commands; browser draft recovery remains separate. */
export function ProjectFileCommands({ allRevisions = false }: { allRevisions?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const wordpressInputRef = useRef<HTMLInputElement>(null)
  const staticInputRef = useRef<HTMLInputElement>(null)
  const [wordpressPreview, setWordpressPreview] = useState<(ReturnType<typeof importWordPressXml> & { originalProjectId: string | null; originalConfig: typeof config }) | null>(null)
  const [staticPreview, setStaticPreview] = useState<(ReturnType<typeof importStaticHtml> & { source: { path: string; text: string }[]; images: File[]; skippedFiles: string[]; originalProjectId: string | null; originalConfig: typeof config }) | null>(null)
  const [opening, setOpening] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingRawDraft, setSavingRawDraft] = useState(false)
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

  async function previewStaticHtml(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])
    if (!files.length || useEditorStore.getState().mediaImporting) return
    const originalProjectId = useEditorStore.getState().activeProjectId
    const originalConfig = useConfigStore.getState().config
    setOpening(true)
    useEditorStore.getState().setMediaImporting(true)
    try {
      if (files.length > 1000) throw new Error('This folder contains more than 1,000 files. Select a smaller site.')
      const selected = files.filter(file => /\.(html?|css)$/i.test(file.name))
      const images = files.filter(file => /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.name))
      const skippedFiles = files.filter(file => !/\.(html?|css|png|jpe?g|gif|webp|avif|svg)$/i.test(file.name)).map(file => file.webkitRelativePath || file.name)
      if (selected.reduce((total, file) => total + file.size, 0) > 1024 * 1024) throw new Error('HTML and CSS files must total at most 1 MiB in this initial importer.')
      if (images.length > 200 || images.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024) throw new Error('Select at most 200 images totaling 100 MiB or less.')
      await requestDesktopAction('project.open', originalProjectId)
      const source = []
      for (const file of selected) source.push({ path: file.webkitRelativePath || file.name, text: decodeProjectFile(new Uint8Array(await file.arrayBuffer())) })
      const preview = importStaticHtml(source, skippedFiles.length, images.map(image => ({ sourcePath: image.webkitRelativePath || image.name, assetId: 'preview', assetPath: 'assets/preview' })))
      if (useEditorStore.getState().activeProjectId !== originalProjectId || useConfigStore.getState().config !== originalConfig) throw new Error('The current project changed. Select the folder again.')
      setStaticPreview({ ...preview, source, images, skippedFiles, originalProjectId, originalConfig })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The HTML folder could not be read.')
    } finally {
      input.value = ''
      setOpening(false)
      useEditorStore.getState().setMediaImporting(false)
    }
  }

  async function createStaticProject() {
    const preview = staticPreview
    if (!preview || useEditorStore.getState().mediaImporting) return
    const stagedId = `proj-${crypto.randomUUID()}`
    const stagedAssets: string[] = []
    const importedImages: { sourcePath: string; assetId: string; assetPath: string }[] = []
    let library: ProjectMediaLibrary | undefined
    let created = false
    useEditorStore.getState().setMediaImporting(true)
    try {
      if (useProjectsStore.getState().projects.some(item => item.id === stagedId)) throw new Error('Project identity is already in use. Try again.')
      if (useEditorStore.getState().activeProjectId !== preview.originalProjectId || useConfigStore.getState().config !== preview.originalConfig) throw new Error('The current project changed. Select the folder again.')
      if (preview.images.length) {
        library = new ProjectMediaLibrary()
        for (const image of preview.images) {
          const result = await library.import(stagedId, image)
          if (!result.duplicate) stagedAssets.push(result.asset.id)
          importedImages.push({ sourcePath: image.webkitRelativePath || image.name, assetId: result.asset.id, assetPath: result.asset.path })
        }
      }
      if (useEditorStore.getState().activeProjectId !== preview.originalProjectId || useConfigStore.getState().config !== preview.originalConfig) throw new Error('The current project changed. Select the folder again.')
      const conversion = importStaticHtml(preview.source, preview.skipped, importedImages)
      const project = conversion.project
      project.webstudioStaticImportReport = { issueCount: conversion.issueCount, issues: conversion.issues, skippedFiles: preview.skippedFiles }
      const id = useProjectsStore.getState().addProject(project.config.name, project, stagedId)
      created = true
      if (stagedAssets.length) useProjectsStore.getState().mediaChanged(id)
      useEditorStore.getState().setActiveProject(id)
      useConfigStore.getState().setConfig(project.config)
      setStaticPreview(null)
      navigate('/editor')
      toast.success('HTML text and images imported as a separate project. Review the conversion before exporting.')
    } catch (error) {
      if (created) useProjectsStore.getState().deleteProject(stagedId)
      for (const id of stagedAssets) await library?.remove(stagedId, id).catch(() => undefined)
      toast.error(error instanceof Error ? error.message : 'The HTML folder could not be imported.')
    } finally { useEditorStore.getState().setMediaImporting(false) }
  }

  async function previewWordPress(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file || useEditorStore.getState().mediaImporting) return
    const originalProjectId = useEditorStore.getState().activeProjectId
    const originalConfig = useConfigStore.getState().config
    setOpening(true)
    useEditorStore.getState().setMediaImporting(true)
    try {
      if (file.size > 1024 * 1024) throw new Error('For this initial importer, select a WordPress XML export of at most 1 MiB.')
      await requestDesktopAction('project.open', originalProjectId)
      const preview = importWordPressXml(decodeProjectFile(new Uint8Array(await file.arrayBuffer())))
      if (useEditorStore.getState().activeProjectId !== originalProjectId || useConfigStore.getState().config !== originalConfig) throw new Error('The current project changed. Select the WordPress export again.')
      setWordpressPreview({ ...preview, originalProjectId, originalConfig })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'WordPress XML could not be read.')
    } finally {
      input.value = ''
      setOpening(false)
      useEditorStore.getState().setMediaImporting(false)
    }
  }

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
    const originalProject = useProjectsStore.getState().projects.find(item => item.id === originalProjectId)
    setOpening(true)
    useEditorStore.getState().setMediaImporting(true)
    let stagedProjectId: string | undefined
    let createdProjectId: string | undefined
    const restoredIds: string[] = []
    let library: ProjectMediaLibrary | undefined
    try {
      await requestDesktopAction('project.open', originalProjectId)
      if (useEditorStore.getState().activeProjectId !== originalProjectId || useConfigStore.getState().config !== originalConfig) throw new Error('The current project changed. Open the file again.')
      if (!file.name.toLowerCase().endsWith('.zip') && file.size > 100 * 1024 * 1024) throw new Error('The project file is too large to open safely (maximum 100 MiB).')
      const zip = file.name.toLowerCase().endsWith('.zip') ? await JSZip.loadAsync(await file.arrayBuffer()) : undefined
      if (zip && Object.values(zip.files).some(entry => !entry.dir && entry.unsafeOriginalName !== entry.name)) {
        throw new Error('The project ZIP contains unsafe file paths.')
      }
      const manifest = zip?.file('project.webstudio.json')
      if (zip && !manifest) throw new Error('The project ZIP has no project.webstudio.json file.')
      const contents = manifest ? await readProjectZipManifest(manifest) : decodeProjectFile(new Uint8Array(await file.arrayBuffer()))
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
      if (useEditorStore.getState().activeProjectId !== originalProjectId || useConfigStore.getState().config !== originalConfig || useProjectsStore.getState().projects.find(item => item.id === originalProjectId) !== originalProject) {
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
    const originalProject = useProjectsStore.getState().projects.find(item => item.id === originalProjectId)
    setCheckingRevision(revision.id)
    try {
      await ProjectRevisions.verify(revision)
      if (useEditorStore.getState().activeProjectId !== originalProjectId || useConfigStore.getState().config !== originalConfig || useProjectsStore.getState().projects.find(item => item.id === originalProjectId) !== originalProject) {
        throw new Error('The current project changed while checking the revision. Your edits remain; try again.')
      }
      if (useEditorStore.getState().mediaImporting) throw new Error('Wait for the current media or save operation to finish, then open the revision again.')
      await openProjectFile(new File([revision.contents], revision.filename, { type: revision.contents.type }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The local revision could not be checked.')
    } finally { setCheckingRevision(null) }
  }

  async function downloadRevision(revision: ProjectRevision) {
    if (checkingRevision || useEditorStore.getState().mediaImporting) return
    setCheckingRevision(revision.id)
    try {
      const verified = await ProjectRevisions.verify(revision)
      if (!/\.webstudio\.(json|zip)$/i.test(revision.filename)) throw new Error('The revision filename is not a WebStudio project filename.')
      const url = URL.createObjectURL(revision.contents)
      try {
        const link = window.document.createElement('a')
        link.href = url
        link.download = revision.filename
        link.click()
      } finally { URL.revokeObjectURL(url) }
      if (verified) toast('Revision download requested. Choose a new filename if prompted.')
      else toast.warning('Older revision has no checksum. Download requested; open the file to verify it.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The local revision could not be downloaded.')
    } finally { setCheckingRevision(null) }
  }

  async function downloadRawDraft() {
    if (savingRawDraft) return
    setSavingRawDraft(true)
    try {
      const zip = new JSZip()
      let available = 0
      const unreadable: string[] = []
      for (const [key, filename] of [['openpage-projects', 'projects.utf16le'], ['openpage-config', 'config.utf16le']]) {
        let raw: string | null
        try { raw = window.localStorage.getItem(key) } catch { unreadable.push(key); continue }
        if (raw === null) continue
        const bytes = new Uint8Array(raw.length * 2)
        for (let index = 0; index < raw.length; index++) {
          const code = raw.charCodeAt(index)
          bytes[index * 2] = code & 255
          bytes[index * 2 + 1] = code >>> 8
        }
        zip.file(filename, bytes)
        available++
      }
      if (!available) throw new Error('No local draft data could be read for recovery.')
      zip.file('READ ME.txt', 'These files contain raw local draft data encoded as UTF-16LE. They are not project files and do not include media. They may contain private settings or saved access keys. Keep them private.\r\n' + (unreadable.length ? `Could not read: ${unreadable.join(', ')}.\r\n` : ''))
      const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }))
      try {
        const link = window.document.createElement('a')
        link.href = url
        link.download = 'webstudio-local-draft-recovery.zip'
        link.click()
      } finally { URL.revokeObjectURL(url) }
      toast('Recovery data download requested. Keep the file private.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Local draft data could not be saved.')
    } finally { setSavingRawDraft(false) }
  }

  async function saveProject(checkpoint = false) {
    if (!project || useEditorStore.getState().mediaImporting) return
    setSaving(true)
    useEditorStore.getState().setMediaImporting(true)
    const preparationToast = toast.loading('Preparing project. Keep this window open until the save finishes.')
    try {
      if (!checkpoint) {
        await requestDesktopAction('project.save', project.id)
        if (useEditorStore.getState().activeProjectId !== project.id || useConfigStore.getState().config !== config) throw new Error('The current project changed. Save it again.')
      }
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
        if (!currentProject || useEditorStore.getState().activeProjectId !== project.id || useConfigStore.getState().config !== config || currentProject.name !== project.name || (currentProject.mediaRevision ?? 0) !== (project.mediaRevision ?? 0) || JSON.stringify(currentProject.settings ?? {}) !== JSON.stringify(project.settings ?? {})) {
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
      if (!currentProject || useEditorStore.getState().activeProjectId !== project.id || useConfigStore.getState().config !== config || currentProject.name !== project.name || (currentProject.mediaRevision ?? 0) !== (project.mediaRevision ?? 0) || JSON.stringify(currentProject.settings ?? {}) !== JSON.stringify(project.settings ?? {})) {
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
    <div className="relative flex flex-wrap items-center gap-2 shrink-0">
      <input ref={inputRef} type="file" accept=".json,.zip,application/json,application/zip" className="hidden" aria-label="Choose project file" onChange={openProject} />
      <input ref={staticInputRef} type="file" multiple {...{ webkitdirectory: '' }} className="hidden" aria-label="Choose static website folder" onChange={previewStaticHtml} />
      <button type="button" onClick={() => staticInputRef.current?.click()} disabled={opening || mediaImporting} className="rounded px-2 py-1 text-xs text-text-1 hover:bg-bg-3 disabled:opacity-50">Import HTML folder</button>
      {staticPreview && <div role="region" aria-label="HTML import report" className="basis-full rounded border border-border-default bg-bg-1 p-3 text-xs text-text-1">
        <p>Found {staticPreview.pages} HTML pages, {staticPreview.stylesheets} stylesheets and {staticPreview.images.length} images; {staticPreview.skipped} other files will not be copied. A separate project will be created.</p>
        <p>Text, recognized headings, lists and emphasis become editable. Supported local images and links to selected HTML pages are placed where recognized. Original HTML and CSS are retained as inactive project data and may contain private information. Layout, styling, scripts, unmatched links and other assets require manual review. Original files are not changed.</p>
        {(staticPreview.issueCount > 0 || staticPreview.skippedFiles.length > 0) && <details className="mt-2">
          <summary className="cursor-pointer">Review {staticPreview.issueCount} reference {staticPreview.issueCount === 1 ? 'issue' : 'issues'} and {staticPreview.skippedFiles.length} skipped {staticPreview.skippedFiles.length === 1 ? 'file' : 'files'}</summary>
          <ul className="mt-1 max-h-40 overflow-y-auto break-all">
            {staticPreview.issues.map((issue, index) => <li key={`issue-${index}`}>{issue.source}: {issue.reason}: {issue.reference}</li>)}
            {staticPreview.skippedFiles.slice(0, 100).map((path, index) => <li key={`skipped-${index}`}>Not copied: {path}</li>)}
          </ul>
          {(staticPreview.issueCount > staticPreview.issues.length || staticPreview.skippedFiles.length > 100) && <p>Additional entries are not shown; review the retained source and original folder.</p>}
        </details>}
        <button type="button" disabled={mediaImporting} className="rounded px-2 py-1 hover:bg-bg-3 disabled:opacity-50" onClick={() => void createStaticProject()}>Create HTML project</button>
        <button type="button" disabled={mediaImporting} className="rounded px-2 py-1 hover:bg-bg-3 disabled:opacity-50" onClick={() => setStaticPreview(null)}>Cancel</button>
      </div>}
      <input ref={wordpressInputRef} type="file" accept=".xml,application/xml,text/xml" className="hidden" aria-label="Choose WordPress XML export" onChange={previewWordPress} />
      <button type="button" onClick={() => wordpressInputRef.current?.click()} disabled={opening || mediaImporting} className="rounded px-2 py-1 text-xs text-text-1 hover:bg-bg-3 disabled:opacity-50">Import WordPress XML</button>
      {wordpressPreview && <div role="region" aria-label="WordPress import report" className="basis-full rounded border border-border-default bg-bg-1 p-3 text-xs text-text-1">
        <p>Found {wordpressPreview.pages} pages and {wordpressPreview.posts} posts; {wordpressPreview.skipped} other items will not be converted. A separate project will be created.</p>
        <p>Text and recognized headings and links become editable. Original XML is retained as inactive project data and may include private author details. Layout, other formatting, unmatched links, media, plugins and themes need manual review; media must be imported separately. Posts and unpublished pages start as drafts; unpublished pages use article draft controls. The original file is not changed.</p>
        {wordpressPreview.issueCount > 0 && <details className="mt-2">
          <summary className="cursor-pointer">Review {wordpressPreview.issueCount} conversion {wordpressPreview.issueCount === 1 ? 'issue' : 'issues'}</summary>
          <ul className="mt-1 max-h-40 overflow-y-auto break-all">{wordpressPreview.issues.map((issue, index) => <li key={index}>{issue.source}: {issue.reason}{issue.reference ? `: ${issue.reference}` : ''}</li>)}</ul>
          {wordpressPreview.issueCount > wordpressPreview.issues.length && <p>Additional entries are not shown; review the retained XML.</p>}
        </details>}
        <button type="button" disabled={mediaImporting} className="rounded px-2 py-1 hover:bg-bg-3 disabled:opacity-50" onClick={() => {
          try {
            if (useEditorStore.getState().activeProjectId !== wordpressPreview.originalProjectId || useConfigStore.getState().config !== wordpressPreview.originalConfig) throw new Error('The current project changed. Select the WordPress export again.')
            const project = structuredClone(wordpressPreview.project)
            project.webstudioWordPressImportReport = { issueCount: wordpressPreview.issueCount, issues: wordpressPreview.issues }
            const id = useProjectsStore.getState().addProject(project.config.name, project)
            useEditorStore.getState().setActiveProject(id)
            useConfigStore.getState().setConfig(project.config)
            setWordpressPreview(null)
            navigate('/editor')
            toast.success('WordPress content imported as a separate project. Review the conversion before exporting.')
          } catch (error) { toast.error(error instanceof Error ? error.message : 'WordPress content could not be imported.') }
        }}>Create imported project</button>
        <button type="button" className="rounded px-2 py-1 hover:bg-bg-3" onClick={() => setWordpressPreview(null)}>Cancel</button>
      </div>}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={opening || mediaImporting}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3 disabled:opacity-50">
        <FolderOpen size={14} />{opening ? 'Opening…' : 'Open project'}
      </button>
      {project && <button type="button" disabled={mediaImporting} onClick={() => void saveProject()}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3 disabled:opacity-50">
        <Save size={14} />{saving ? 'Preparing project…' : 'Save project'}
      </button>}
      {allRevisions && (projectDraftReadFailed || configDraftReadFailed) && <div className="basis-full text-xs text-text-2">
        <button type="button" disabled={savingRawDraft} onClick={() => void downloadRawDraft()} className="rounded px-2 py-1 text-text-1 hover:bg-bg-3 disabled:opacity-50">{savingRawDraft ? 'Preparing recovery data…' : 'Save unreadable draft data'}</button>
        <span>Raw data is not a project file, excludes media and may contain private settings or access keys.</span>
      </div>}
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
            <button type="button" disabled={mediaImporting || !!checkingRevision} className="rounded px-2 py-1 text-text-1 hover:bg-bg-3 disabled:opacity-50" onClick={() => void downloadRevision(revision)}>Save revision as file</button>
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
