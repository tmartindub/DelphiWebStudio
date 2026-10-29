import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { createProjectFile, parseProjectFile, portableProjectsEnabled, serializeProjectFile } from './project-file'

/** Explicit portable-file commands; browser draft recovery remains separate. */
export function ProjectFileCommands() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [opening, setOpening] = useState(false)
  const navigate = useNavigate()
  const config = useConfigStore(state => state.config)
  const activeProjectId = useEditorStore(state => state.activeProjectId)
  const project = useProjectsStore(state => state.projects.find(item => item.id === activeProjectId))

  if (!portableProjectsEnabled) return null

  async function openProject(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setOpening(true)
    try {
      const { project, migrated } = parseProjectFile(await file.text())
      // Import always creates a separate local project; the selected source file is never modified.
      const id = useProjectsStore.getState().addProject(project.config.name, project)
      useEditorStore.getState().setActiveProject(id)
      useConfigStore.getState().setConfig(project.config)
      navigate('/editor')
      toast.success(migrated ? 'Legacy project opened. Save a new WebStudio file to keep the upgrade.' : 'Project opened as a separate local copy.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Project could not be opened.')
    } finally {
      input.value = ''
      setOpening(false)
    }
  }

  function saveProject() {
    if (!project) return
    try {
      const projectDocument = {
        ...project.projectFile,
        ...createProjectFile(config, project.projectFile?.projectId ?? project.id),
      }
      const contents = serializeProjectFile(projectDocument)
      const filename = (project.name.replace(/[<>:"/\\|?*\p{Cc}]/gu, '-').trim().slice(0, 100) || 'site') + '.webstudio.json'
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
      const link = window.document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      useProjectsStore.getState().saveProjectFile(project.id, projectDocument)
      toast.success('Project file download started.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Project could not be saved.')
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <input ref={inputRef} type="file" accept=".json,.webstudio.json,application/json" className="hidden" aria-label="Choose project file" onChange={openProject} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={opening}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3 disabled:opacity-50">
        <FolderOpen size={14} />{opening ? 'Opening…' : 'Open project'}
      </button>
      {project && <button type="button" onClick={saveProject}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3">
        <Save size={14} />Save project
      </button>}
    </div>
  )
}
