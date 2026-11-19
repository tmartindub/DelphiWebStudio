import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Code,
  Clock,
  Eye,
  Plus,
  HelpCircle,
  Download,
  Loader2,
  Pencil,
  Trash2,
  Link,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEditorStore, type Viewport, type EditorMode } from '@/store/editorStore'
import { useConfigStore } from '@/store/configStore'
import { useProjectsStore } from '@/store/projectsStore'
import type { PageConfig } from '@/blocks/types'
import { exportToHTML, downloadHTML, exportSiteZip } from '@/lib/export-html'
import { ProjectFileCommands } from '@/project/ProjectFileCommands'
import { portableProjectsEnabled } from '@/project/project-file'
import { ProjectMediaLibrary } from '@/media/media-library'
import { PlanPages } from './PlanPages'
import { SiteChecks } from './SiteChecks'

const viewports: { value: Viewport; icon: typeof Monitor; label: string }[] = [
  { value: 'desktop', icon: Monitor, label: 'Desktop' },
  { value: 'tablet', icon: Tablet, label: 'Tablet' },
  { value: 'mobile', icon: Smartphone, label: 'Mobile' },
]

function AddPagePopover({ onAdd, onClose }: { onAdd: (name: string, path: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    const cleanPath = path.trim() || `/${trimmed.toLowerCase().replace(/\s+/g, '-')}`
    try {
      onAdd(trimmed, cleanPath)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Page could not be added')
    }
  }

  return (
    <div className="absolute top-full left-0 mt-1 bg-bg-2 border border-border-default rounded-lg p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-20 w-52">
      <div className="space-y-2">
        <div>
          <label className="block text-[10px] text-text-3 mb-0.5">Page name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
            placeholder="About"
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-3 text-text-0 text-[11.5px] outline-none focus:border-green"
          />
        </div>
        <div>
          <label className="block text-[10px] text-text-3 mb-0.5">Path</label>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
            placeholder="/about"
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-3 text-text-0 text-[11.5px] outline-none focus:border-green font-mono"
          />
        </div>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full py-1.5 rounded bg-green text-black text-[11px] font-semibold hover:bg-green-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Add Page
        </button>
      </div>
    </div>
  )
}

function PageTab({ page, isActive, onClick, onRename, onEditPath, onEditSeo, onDelete, canDelete }: {
  page: PageConfig
  isActive: boolean
  onClick: () => void
  onRename: (name: string) => void
  onEditPath: () => void
  onEditSeo: () => void
  onDelete: () => void
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(page.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commitRename() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== page.name) onRename(trimmed)
    else setName(page.name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={`Rename ${page.name}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename()
          if (e.key === 'Escape') { setName(page.name); setEditing(false) }
        }}
        className="px-2 py-1 rounded text-xs bg-bg-3 border border-green outline-none w-20"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <div className="flex items-center shrink-0">
      <button
        onClick={onClick}
        onDoubleClick={(e) => { e.stopPropagation(); setName(page.name); setEditing(true) }}
        className={`px-2 py-1 rounded text-xs transition-all ${
          isActive ? 'bg-bg-3 text-text-0' : 'text-text-3 hover:text-text-1 hover:bg-bg-2'
        }`}
        title={`${page.name} (${page.path})`}
      >
        {page.name}
      </button>
      {isActive && <button type="button" aria-label={`Rename ${page.name}`} title={`Rename ${page.name}`}
        onClick={() => { setName(page.name); setEditing(true) }}
        className="p-1 rounded text-text-3 hover:text-text-0 focus-visible:outline focus-visible:outline-2"><Pencil size={12} /></button>}
      {isActive && <button type="button" aria-label={`Search details for ${page.name}`} title={`Search details for ${page.name}`}
        onClick={onEditSeo} className="p-1 rounded text-text-3 hover:text-text-0 focus-visible:outline focus-visible:outline-2"><Search size={12} /></button>}
      {isActive && page.path !== '/' && <button type="button" aria-label={`Change address for ${page.name}`} title={`Change address for ${page.name}`}
        onClick={onEditPath} className="p-1 rounded text-text-3 hover:text-text-0 focus-visible:outline focus-visible:outline-2"><Link size={12} /></button>}
      {isActive && canDelete && <button type="button" aria-label={`Delete ${page.name}`}
        title={`Delete ${page.name}`}
        onClick={onDelete}
        className="p-1 rounded text-text-3 hover:text-status-red focus-visible:outline focus-visible:outline-2">
        <Trash2 size={12} />
      </button>}
    </div>
  )
}

function EditPageSeoDialog({ page, onCancel, onSave }: { page: PageConfig; onCancel: () => void; onSave: (title: string, description: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(page.webstudioSeo?.title ?? '')
  const [description, setDescription] = useState(page.webstudioSeo?.description ?? '')
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { if (element?.open) element.close() } }, [])
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onCancel() }} aria-labelledby="page-seo-title" className="w-[min(92vw,32rem)] rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
    <h2 id="page-seo-title" className="text-lg font-semibold">Search details for {page.name}</h2>
    <p className="mt-2 text-sm text-text-2">Set this page's title and description for search and sharing. Leave either blank to use the site-wide setting.</p>
    <label htmlFor="page-search-title" className="mt-4 block text-sm">Page title</label>
    <input id="page-search-title" value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-3 py-2 text-sm" />
    <label htmlFor="page-search-description" className="mt-3 block text-sm">Page description</label>
    <textarea id="page-search-description" value={description} onChange={event => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-3 py-2 text-sm" />
    {error && <p role="alert" className="mt-2 text-sm text-status-red">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded border border-border-default px-3 py-2 text-sm">Cancel</button><button type="button" onClick={() => { try { onSave(title, description) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Search details could not be saved.') } }} className="rounded bg-green px-3 py-2 text-sm font-semibold text-black">Save details</button></div>
  </dialog>
}

function EditPagePathDialog({ page, onCancel, onSave }: { page: PageConfig; onCancel: () => void; onSave: (path: string, updateLinks: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [path, setPath] = useState(page.path)
  const [error, setError] = useState('')
  const [updateLinks, setUpdateLinks] = useState(true)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { if (element?.open) element.close() } }, [])
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onCancel() }} aria-labelledby="page-path-title" className="w-[min(92vw,32rem)] rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
    <h2 id="page-path-title" className="text-lg font-semibold">Change address for {page.name}</h2>
    <p className="mt-2 text-sm text-text-2">External bookmarks and links in unsupported content may stop working. You can undo this change.</p>
    <label htmlFor="page-path" className="mt-4 block text-sm">Page address</label>
    <input id="page-path" value={path} onChange={event => { setPath(event.target.value); setError('') }} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-3 py-2 text-sm" />
    <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={updateLinks} onChange={event => setUpdateLinks(event.target.checked)} /> Update Content text links and known Hero, CTA, Banner and Navbar button links to this page.</label>
    {error && <p role="alert" className="mt-2 text-sm text-status-red">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded border border-border-default px-3 py-2 text-sm">Cancel</button><button type="button" onClick={() => { try { onSave(path.trim(), updateLinks) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Address could not be changed.') } }} className="rounded bg-green px-3 py-2 text-sm font-semibold text-black">Save address</button></div>
  </dialog>
}

function DeletePageDialog({ page, linkedPages, onCancel, onConfirm }: {
  page: PageConfig
  linkedPages: PageConfig[]
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [])
  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); onCancel() }} aria-labelledby="delete-page-title" className="w-[min(92vw,32rem)] rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
      <h2 id="delete-page-title" className="text-lg font-semibold">Delete {page.name}?</h2>
      <p className="mt-2 text-sm text-text-2">This removes the page and its contents. You can restore it with Undo.</p>
      {linkedPages.length > 0 && <div className="mt-3 rounded border border-status-red/40 p-3 text-sm" role="status">
        <p>These pages have known text or button links pointing to {page.path}. Those links will no longer reach this page:</p>
        <ul className="mt-2 list-disc pl-5">{linkedPages.map(linked => <li key={linked.id}>{linked.name}</li>)}</ul>
      </div>}
      <p className="mt-3 text-xs text-text-2">Other links, including links in unsupported or custom content, are not checked.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded border border-border-default px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={onConfirm} className="rounded bg-status-red px-3 py-2 text-sm font-semibold text-white">Delete page</button>
      </div>
    </dialog>
  )
}

export function CanvasToolbar() {
  const navigate = useNavigate()
  const { viewport, setViewport, mode, setMode, toggleJsonDrawer, jsonDrawerOpen, toggleHistory, togglePreview, toggleShortcutsModal, previewMode, activeProjectId } = useEditorStore()
  const { undo, redo, canUndo, canRedo } = useConfigStore()
  const undoStack = useConfigStore((s) => s.undoStack)
  const redoStack = useConfigStore((s) => s.redoStack)
  const pages = useConfigStore((s) => s.config.pages) ?? []
  const activePageId = useConfigStore((s) => s.activePageId)
  const setActivePage = useConfigStore((s) => s.setActivePage)
  const addPage = useConfigStore((s) => s.addPage)
  const removePage = useConfigStore((s) => s.removePage)
  const renamePage = useConfigStore((s) => s.renamePage)
  const changePagePath = useConfigStore((s) => s.changePagePath)
  const updatePageSeo = useConfigStore((s) => s.updatePageSeo)
  const projects = useProjectsStore((s) => s.projects)
  const configName = useConfigStore((s) => s.config.name)
  const config = useConfigStore((s) => s.config)
  const [showAddPage, setShowAddPage] = useState(false)
  const [showPlanPages, setShowPlanPages] = useState(false)
  const [showSiteChecks, setShowSiteChecks] = useState(false)
  const [deletingPage, setDeletingPage] = useState<{ id: string; projectId: string | null } | null>(null)
  const [editingPath, setEditingPath] = useState<{ id: string; projectId: string | null } | null>(null)
  const [editingSeo, setEditingSeo] = useState<{ id: string; projectId: string | null } | null>(null)
  const [exporting, setExporting] = useState(false)

  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null
  const projectName = activeProject?.name || configName
  const pageToDelete = pages.find(page => page.id === deletingPage?.id && deletingPage.projectId === activeProjectId)
  const pageToEditPath = pages.find(page => page.id === editingPath?.id && editingPath.projectId === activeProjectId)
  const pageToEditSeo = pages.find(page => page.id === editingSeo?.id && editingSeo.projectId === activeProjectId)
  const linkedPages = pageToDelete ? pages.filter(page => page.id !== pageToDelete.id && page.blocks.some(block => {
    if (block.type === 'content' && typeof block.props.body === 'string' && [...block.props.body.matchAll(/\[([^\]\n]+)\]\(([^)\s]+)\)/g)].some(match => {
      const path = match[2].split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
      return path === pageToDelete.path || path === encodeURI(pageToDelete.path)
    })) return true
    if (block.type === 'navbar' && Array.isArray(block.props.navItems) && block.props.navItems.some(item => {
      if (!item || typeof item.url !== 'string') return false
      const path = item.url.trim().split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
      return path === pageToDelete.path || path === encodeURI(pageToDelete.path)
    })) return true
    const keys = block.type === 'hero' ? ['primaryCtaUrl', 'secondaryCtaUrl'] : block.type === 'cta' ? ['buttonUrl'] : block.type === 'banner' ? ['linkUrl'] : block.type === 'navbar' ? ['ctaUrl'] : []
    return keys.some(key => {
      const value = block.props[key]
      if (typeof value !== 'string') return false
      const path = value.trim().split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
      return path === pageToDelete.path || path === encodeURI(pageToDelete.path)
    })
  })) : []

  async function handleExport() {
    setExporting(true)
    try {
      const filename = (activeProject?.name || config.name || 'site').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
      if (portableProjectsEnabled) {
        const media = activeProjectId ? await new ProjectMediaLibrary().list(activeProjectId) : []
        downloadHTML(await exportSiteZip(config, { settings: activeProject?.settings }, media), `${filename}.zip`)
        toast('Website ZIP exported')
      } else {
        downloadHTML(await exportToHTML(config, { settings: activeProject?.settings }), `${filename}.html`)
        toast('HTML exported')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
    {showPlanPages && <PlanPages onClose={() => setShowPlanPages(false)} />}
    {showSiteChecks && <SiteChecks onClose={() => setShowSiteChecks(false)} />}
    {pageToDelete && <DeletePageDialog page={pageToDelete} linkedPages={linkedPages} onCancel={() => setDeletingPage(null)} onConfirm={() => { removePage(pageToDelete.id); setDeletingPage(null) }} />}
    {pageToEditPath && <EditPagePathDialog page={pageToEditPath} onCancel={() => setEditingPath(null)} onSave={(path, updateLinks) => { changePagePath(pageToEditPath.id, path, updateLinks); setEditingPath(null) }} />}
    {pageToEditSeo && <EditPageSeoDialog page={pageToEditSeo} onCancel={() => setEditingSeo(null)} onSave={(title, description) => { updatePageSeo(pageToEditSeo.id, title, description); setEditingSeo(null) }} />}
    {portableProjectsEnabled && <div className="bg-bg-1 border-b border-border-default px-3 py-1"><ProjectFileCommands /></div>}
    <div className="min-h-10 bg-bg-1 border-b border-border-default flex flex-wrap items-center px-3 py-1 gap-1">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-3 shrink-0">
        <span
          className="cursor-pointer hover:text-text-1 transition-colors"
          onClick={() => navigate('/')}
        >
          Projects
        </span>
        <span>/</span>
        <span className="text-text-0 font-medium max-w-[120px] truncate">{projectName}</span>
      </div>

      <div className="w-px h-5 bg-border-default mx-1.5 shrink-0" />

      {/* Page tabs */}
      <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto">
        {pages.map((page) => (
          <PageTab
            key={page.id}
            page={page}
            isActive={activePageId === page.id}
            onClick={() => setActivePage(page.id)}
            onRename={(name) => renamePage(page.id, name)}
            onEditPath={() => setEditingPath({ id: page.id, projectId: activeProjectId })}
            onEditSeo={() => setEditingSeo({ id: page.id, projectId: activeProjectId })}
            onDelete={() => setDeletingPage({ id: page.id, projectId: activeProjectId })}
            canDelete={pages.length > 1 && page.path !== '/'}
          />
        ))}
      </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowAddPage(!showAddPage)}
            className="w-6 h-6 rounded flex items-center justify-center text-text-3 hover:text-green hover:bg-bg-2 transition-all"
            title="Add page"
            aria-label="Add page"
          >
            <Plus size={12} />
          </button>
          {showAddPage && (
            <AddPagePopover
              onAdd={(name, path) => addPage(name, path)}
              onClose={() => setShowAddPage(false)}
            />
          )}
        </div>

      {/* Right side */}
      <div className="ml-auto flex flex-wrap justify-end items-center gap-1 min-w-0">
        {portableProjectsEnabled && <button type="button" onClick={() => setShowPlanPages(true)} className="px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3">Plan pages</button>}
        {portableProjectsEnabled && <button type="button" onClick={() => setShowSiteChecks(true)} className="px-2 py-1 rounded text-xs text-text-1 hover:bg-bg-3">Check site</button>}
        <label className="text-xs text-text-1 flex items-center gap-1">
          Mode
          <select aria-label="Editor mode" value={mode} onChange={event => setMode(event.target.value as EditorMode)} className="rounded bg-bg-2 border border-border-default px-1 py-1 text-text-0">
            <option value="beginner">Beginner</option>
            <option value="designer">Designer</option>
            <option value="professional">Professional (JSON)</option>
          </select>
        </label>
        {/* Viewport toggle */}
        {viewports.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            title={label}
            aria-label={label}
            aria-pressed={viewport === value}
            onClick={() => setViewport(value)}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${
              viewport === value
                ? 'bg-bg-3 text-text-0'
                : 'text-text-3 hover:text-text-1 hover:bg-bg-3'
            }`}
          >
            <Icon size={14} />
          </button>
        ))}

        <div className="w-px h-5 bg-border-default mx-1" />

        {/* Undo/Redo */}
        <button
          onClick={() => {
            const label = undoStack[undoStack.length - 1]?.label
            undo()
            if (label) toast(`Undo: ${label}`, { duration: 1500 })
          }}
          disabled={!canUndo()}
          className="w-7 h-7 rounded flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={() => {
            const label = redoStack[redoStack.length - 1]?.label
            redo()
            if (label) toast(`Redo: ${label}`, { duration: 1500 })
          }}
          disabled={!canRedo()}
          className="w-7 h-7 rounded flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 size={14} />
        </button>

        <div className="w-px h-5 bg-border-default mx-1" />

        {/* Preview toggle */}
        <button
          onClick={togglePreview}
          className={`h-7 px-2 rounded flex items-center gap-1 text-[11px] transition-all ${
            previewMode ? 'bg-green-glow text-green' : 'text-text-3 hover:text-text-1 hover:bg-bg-3'
          }`}
          title="Preview (P)"
          aria-label="Toggle preview mode"
          aria-pressed={previewMode}
        >
          <Eye size={13} />
          <span>Preview</span>
        </button>

        {/* JSON drawer toggle */}
        <button
          onClick={toggleJsonDrawer}
          className={`h-7 px-2 rounded flex items-center gap-1 text-[11px] transition-all ${
            jsonDrawerOpen ? 'bg-green-glow text-green' : 'text-text-3 hover:text-text-1 hover:bg-bg-3'
          }`}
          title="JSON (J)"
          aria-label="Toggle JSON drawer"
          aria-pressed={jsonDrawerOpen}
        >
          <Code size={13} />
          <span>JSON</span>
        </button>

        {/* History */}
        <button
          onClick={toggleHistory}
          className="h-7 px-2 rounded flex items-center gap-1 text-[11px] text-text-3 hover:text-text-1 hover:bg-bg-3 transition-all"
          title="History (H)"
          aria-label="Toggle version history"
        >
          <Clock size={13} />
          <span>History</span>
        </button>

        {/* Shortcuts help */}
        <button
          onClick={toggleShortcutsModal}
          className="w-7 h-7 rounded flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-3 transition-all"
          title="Keyboard shortcuts (?)"
          aria-label="Show keyboard shortcuts"
        >
          <HelpCircle size={14} />
        </button>

        <div className="w-px h-5 bg-border-default mx-1" />

        <button
          onClick={handleExport}
          disabled={exporting}
          className="h-7 px-3 rounded-lg bg-green text-bg-0 text-[11.5px] font-semibold hover:bg-green/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {exporting ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download size={12} />
              <span>Export</span>
            </>
          )}
        </button>
      </div>
    </div>
    </>
  )
}
