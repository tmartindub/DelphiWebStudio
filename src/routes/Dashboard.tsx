import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Search, Sparkles, Trash2, FolderOpen, Copy, Pencil, Layers, Briefcase, UtensilsCrossed, Building2, BookOpen } from 'lucide-react'
import { useProjectsStore, type Project } from '@/store/projectsStore'
import { useConfigStore, defaultConfig } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { hexToRgb } from '@/lib/theme-presets'
import { templateMeta, buildTemplate, getTemplateForPrompt } from '@/lib/templates'
import { ProjectFileCommands } from '@/project/ProjectFileCommands'
import { portableProjectsEnabled } from '@/project/project-file'

const templateIcons: Record<string, typeof Briefcase> = {
  Briefcase, UtensilsCrossed, Building2, BookOpen,
}

const suggestions = [
  { label: 'Personal site', prompt: 'Personal website' },
  { label: 'Community group', prompt: 'Community organization' },
  { label: 'Church', prompt: 'Church website' },
  { label: 'Documentation', prompt: 'Documentation website' },
]

const filters = ['All', 'Published', 'Drafts'] as const
type Filter = (typeof filters)[number]

const fallbackAccents = ['#22c55e', '#3b82f6', '#f472b6', '#8b5cf6', '#e8a838', '#06b6d4', '#10b981', '#ef4444']

function projectHash(name: string): number {
  return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

function projectAccent(project: Project): string {
  if (project.config?.theme?.accent) return project.config.theme.accent
  return fallbackAccents[projectHash(project.name) % fallbackAccents.length]
}

function PromptSection() {
  const navigate = useNavigate()
  const addProject = useProjectsStore((s) => s.addProject)
  const updateProjectConfig = useProjectsStore((s) => s.updateProjectConfig)
  const setConfig = useConfigStore((s) => s.setConfig)
  const setActiveProject = useEditorStore((s) => s.setActiveProject)

  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function startBlank() {
    const id = addProject('Untitled Project')
    updateProjectConfig(id, defaultConfig)
    setActiveProject(id)
    setConfig(defaultConfig)
    navigate('/editor')
  }

  function startFromTemplate(tplId: string, tplName: string) {
    const id = addProject(tplName)
    const config = buildTemplate(tplId, tplName)
    updateProjectConfig(id, config)
    setActiveProject(id)
    setConfig(config)
    navigate('/editor')
  }

  function generate(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    const placeholderName = trimmed.split(/\s+/).slice(0, 4).join(' ')
    const id = addProject(placeholderName.charAt(0).toUpperCase() + placeholderName.slice(1))
    const config = getTemplateForPrompt(trimmed)
    updateProjectConfig(id, config)
    setActiveProject(id)
    setConfig(config)
    navigate('/editor')
  }

  const isFocused = prompt.length > 0

  return (
    <div className="relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-green/[0.07] rounded-full blur-[150px]" />
      </div>

      <div className="relative flex flex-col items-center pt-16 pb-6 px-6">
        <h1 className="text-[36px] font-display font-bold tracking-tight mb-2 text-center animate-fade-in-up stagger-1">What will you build?</h1>
        <p className="text-text-2 text-[15px] mb-8 text-center animate-fade-in-up stagger-2">Choose a starter or describe the kind of site you want.</p>

        {/* Prompt card - gradient border wrapper */}
        <div className={`w-full max-w-[680px] rounded-2xl p-px transition-all duration-300 animate-scale-in stagger-3 ${
          isFocused
            ? 'bg-gradient-to-b from-green/40 via-green/20 to-green/5 shadow-[0_0_80px_rgba(242,138,37,0.15)]'
            : 'bg-gradient-to-b from-border-hover via-border-default to-border-subtle shadow-[0_0_60px_rgba(242,138,37,0.06)] hover:from-green/25 hover:via-green/10 hover:to-green/5 hover:shadow-[0_0_80px_rgba(242,138,37,0.1)]'
        }`}>
          <div className="bg-bg-1 rounded-[15px] overflow-hidden">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  generate(prompt)
                }
              }}
              rows={3}
              placeholder="A website for our community group..."
              className="w-full px-5 pt-5 pb-3 bg-transparent text-text-0 text-[14px] placeholder:text-text-3 resize-none leading-relaxed"
            />

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1">
              <div className="flex items-center gap-1.5 animate-fade-in stagger-4">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => { setPrompt(s.prompt); textareaRef.current?.focus() }}
                    className="px-2.5 py-1 rounded-full text-text-3 text-[11px] border border-border-default hover:text-text-0 hover:bg-bg-3 hover:border-border-hover transition-all"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {prompt.trim() && (
                  <span className="text-[10px] text-text-3 hidden sm:inline">
                    {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter
                  </span>
                )}
                <button
                  onClick={() => generate(prompt)}
                  disabled={!prompt.trim()}
                  className="px-5 py-2.5 rounded-xl bg-green text-black text-[13px] font-semibold hover:bg-green-dim active:scale-[0.97] transition-all disabled:opacity-20 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-[0_0_20px_rgba(242,138,37,0.3)] hover:shadow-[0_0_30px_rgba(242,138,37,0.4)]"
                >
                  <Sparkles size={14} />
                  Create starter
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Template cards */}
        <div className="w-full max-w-[680px] mt-5 grid grid-cols-2 md:grid-cols-4 gap-2.5 animate-fade-in-up stagger-5">
          {templateMeta.map((tpl) => {
            const rgb = hexToRgb(tpl.accent)
            const Icon = templateIcons[tpl.icon] || Layers
            return (
              <button
                key={tpl.id}
                onClick={() => startFromTemplate(tpl.id, tpl.name)}
                className="group relative bg-bg-1 border border-border-default rounded-xl p-3.5 text-left transition-all hover:border-border-hover card-lift hover:card-lift-hover active:scale-[0.97]"
              >
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                  style={{ background: `rgba(${rgb}, 0.06)` }}
                />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all opacity-70 group-hover:opacity-100 group-hover:scale-110"
                      style={{ background: `rgba(${rgb}, 0.12)`, color: tpl.accent }}
                    >
                      <Icon size={14} />
                    </div>
                    <div className="text-[12.5px] font-semibold text-text-0">{tpl.name}</div>
                  </div>
                  <div className="text-[10.5px] text-text-2 leading-snug">{tpl.description}</div>
                  <div className="mt-2.5 flex items-center gap-1 text-[10px] text-text-3">
                    <Layers size={10} />
                    {tpl.blockCount} blocks
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Start blank + API key hint */}
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <button
            onClick={startBlank}
            className="text-text-3 text-[11px] hover:text-text-1 transition-colors"
          >
            or start blank
          </button>
          <p className="text-text-3 text-[10.5px]">Starters are created locally and can be edited.</p>
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()
  const renameProject = useProjectsStore((s) => s.renameProject)
  const deleteProject = useProjectsStore((s) => s.deleteProject)
  const restoreProject = useProjectsStore((s) => s.restoreProject)
  const duplicateProject = useProjectsStore((s) => s.duplicateProject)
  const setConfig = useConfigStore((s) => s.setConfig)
  const setActiveProject = useEditorStore((s) => s.setActiveProject)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [name, setName] = useState(project.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) }
  }, [])

  function commitRename() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== project.name) {
      renameProject(project.id, trimmed)
    } else {
      setName(project.name)
    }
    setEditing(false)
  }

  function openProject() {
    setActiveProject(project.id)
    const config = project.config ?? project.projectFile?.config ?? defaultConfig
    const home = config.pages?.find(page => page.path === '/') ?? config.pages?.[0]
    setConfig(Array.isArray(config.blocks) ? config : { ...config, blocks: home?.blocks ?? [] })
    navigate('/editor')
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirming) {
      deleteProject(project.id)
      toast('Project removed.', { duration: 15000, action: { label: 'Undo', onClick: () => restoreProject(project) } })
    } else {
      setConfirming(true)
      confirmTimer.current = setTimeout(() => setConfirming(false), 2000)
    }
  }

  const accent = projectAccent(project)
  const rgb = hexToRgb(accent)
  const layout = projectHash(project.name) % 3

  return (
    <div
      onClick={openProject}
      className="group bg-bg-1 border border-border-default rounded-xl overflow-hidden cursor-pointer card-lift hover:border-border-hover hover:card-lift-hover"
    >
      {/* Thumbnail */}
      <div className="h-32 bg-bg-2 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-300"
          style={{ background: `linear-gradient(135deg, ${accent}, transparent)` }}
        />

        {/* Action buttons */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); void duplicateProject(project.id).then(id => { if (id) toast('Project duplicated'); else toast.error('Project not found.') }).catch((error: unknown) => toast.error(error instanceof Error && error.message === 'The project changed while it was being duplicated. Try again.' ? error.message : 'Project could not be duplicated. The original was not changed.')) }}
            aria-label={`Duplicate ${project.name}`}
            className="p-1.5 rounded-md border bg-bg-0/80 border-border-default text-text-3 opacity-0 group-hover:opacity-100 hover:text-green hover:border-green/30 transition-all"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={handleDelete}
            aria-label={confirming ? `Confirm delete ${project.name}` : `Delete ${project.name}`}
            className={`rounded-md border transition-all ${
              confirming
                ? 'px-2 py-1 bg-status-red/90 border-status-red text-white text-[10px] font-medium opacity-100'
                : 'p-1.5 bg-bg-0/80 border-border-default text-text-3 opacity-0 group-hover:opacity-100 hover:text-status-red hover:border-status-red/30'
            }`}
          >
            {confirming ? 'Delete?' : <Trash2 size={12} />}
          </button>
        </div>

        {/* Wireframe - varies by project name hash */}
        <div className="absolute inset-3 flex flex-col gap-1.5 p-2.5">
          {layout === 0 && (
            <>
              <div className="h-2 rounded-sm w-2/3" style={{ background: `rgba(${rgb}, 0.15)` }} />
              <div className="h-1.5 bg-bg-4/40 rounded-sm w-1/2" />
              <div className="flex gap-1.5 mt-auto">
                <div className="flex-1 h-6 rounded" style={{ background: `rgba(${rgb}, 0.07)` }} />
                <div className="flex-1 h-6 rounded" style={{ background: `rgba(${rgb}, 0.07)` }} />
                <div className="flex-1 h-6 rounded" style={{ background: `rgba(${rgb}, 0.07)` }} />
              </div>
            </>
          )}
          {layout === 1 && (
            <>
              <div className="flex gap-2 flex-1">
                <div className="flex-1 flex flex-col gap-1">
                  <div className="h-2 rounded-sm w-3/4" style={{ background: `rgba(${rgb}, 0.15)` }} />
                  <div className="h-1.5 bg-bg-4/40 rounded-sm w-full" />
                  <div className="h-1.5 bg-bg-4/40 rounded-sm w-2/3" />
                  <div className="h-4 rounded w-1/2 mt-auto" style={{ background: `rgba(${rgb}, 0.12)` }} />
                </div>
                <div className="w-16 rounded" style={{ background: `rgba(${rgb}, 0.06)` }} />
              </div>
            </>
          )}
          {layout === 2 && (
            <>
              <div className="flex justify-center mt-1">
                <div className="h-2 rounded-sm w-1/3" style={{ background: `rgba(${rgb}, 0.15)` }} />
              </div>
              <div className="flex justify-center">
                <div className="h-1.5 bg-bg-4/40 rounded-sm w-2/3" />
              </div>
              <div className="flex gap-1 mt-auto justify-center">
                <div className="w-12 h-4 rounded" style={{ background: `rgba(${rgb}, 0.12)` }} />
                <div className="w-12 h-4 rounded bg-bg-4/30" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setName(project.name); setEditing(false) }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[13px] font-semibold mb-1 bg-transparent border-b border-green outline-none w-full"
          />
        ) : (
          <div
            className="text-[13px] font-semibold mb-1 transition-colors text-text-0 flex items-center gap-1.5 group/name"
          >
            <span className="truncate">{project.name}</span>
            <button type="button" aria-label={`Rename ${project.name}`} onClick={(event) => { event.stopPropagation(); setName(project.name); setEditing(true) }} className="text-text-3 hover:text-green focus-visible:text-green shrink-0">
              <Pencil size={10} />
            </button>
          </div>
        )}
        <div className="text-[10.5px] text-text-2 flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                project.status === 'published' ? 'bg-green' : 'bg-status-yellow'
              }`}
            />
            {project.status === 'published' ? 'Published' : 'Draft'}
          </span>
          <span className="text-text-3">{project.updatedAt}</span>
        </div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const projects = useProjectsStore((s) => s.projects)
  const [filter, setFilter] = useState<Filter>('All')
  const [search, setSearch] = useState('')

  const filtered = projects.filter((p) => {
    if (filter === 'Published' && p.status !== 'published') return false
    if (filter === 'Drafts' && p.status !== 'draft') return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="h-full overflow-y-auto">
      {portableProjectsEnabled && <div className="px-4 md:px-12 pt-4"><ProjectFileCommands allRevisions /></div>}
      <PromptSection />

      {/* Projects section */}
      {projects.length > 0 && (
        <>
          <div className="px-4 md:px-12 pt-4">
            <div className="border-t border-border-subtle" />
          </div>

          <div className="px-4 md:px-12 pt-5 flex flex-col sm:flex-row gap-2 items-start sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[13px] font-semibold text-text-1 animate-fade-in">
                Your projects
                <span className="text-text-3 font-normal ml-1.5">({projects.length})</span>
              </h2>
              <div className="flex gap-1">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                      filter === f
                        ? 'text-text-0 bg-bg-3 border border-border-default'
                        : 'text-text-2 border border-transparent hover:text-text-1 hover:bg-bg-2'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3"
              />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 rounded-md border border-border-default bg-bg-2 text-text-0 text-[12px] w-44 outline-none focus:border-green placeholder:text-text-3"
              />
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="px-4 md:px-12 pt-4 pb-12 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
              {filtered.map((p, i) => (
                <div key={p.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <ProjectCard project={p} />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 md:px-12 pt-8 pb-12 flex flex-col items-center text-center">
              <FolderOpen size={28} className="text-text-3 mb-2" />
              <p className="text-text-2 text-[13px]">No projects match your filter</p>
              <button
                onClick={() => { setFilter('All'); setSearch('') }}
                className="mt-2 text-green text-[12px] hover:text-green-dim transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
