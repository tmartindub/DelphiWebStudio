import { useState } from 'react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { validateProjectConfig } from '@/project/project-file'
import { exportSiteToHTML } from '@/lib/export-html'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function syntaxHighlight(json: string): string {
  const escaped = escapeHtml(json)
  return escaped.replace(
    /(&quot;(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\&])*?&quot;(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-status-yellow' // number
      if (/^&quot;/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-sky-300' // key
          match = match.replace(/:$/, '')
          return `<span class="${cls}">${match}</span>:`
        } else {
          cls = 'text-emerald-300' // string
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-status-blue'
      } else if (/null/.test(match)) {
        cls = 'text-text-3'
      }
      return `<span class="${cls}">${match}</span>`
    }
  )
}

export function JsonDrawer() {
  const config = useConfigStore((s) => s.config)
  const activePageId = useConfigStore((s) => s.activePageId)
  const replaceConfig = useConfigStore((s) => s.replaceConfig)
  const { jsonDrawerOpen, toggleJsonDrawer, activeProjectId } = useEditorStore()
  const settings = useProjectsStore((s) => s.projects.find(project => project.id === activeProjectId)?.settings)
  const projectFile = useProjectsStore((s) => s.projects.find(project => project.id === activeProjectId)?.projectFile)
  const [editing, setEditing] = useState(false)
  const [pageSource, setPageSource] = useState<string | null>(null)
  const [importedSelection, setImportedSelection] = useState<{ projectId: string | null; index: number } | null>(null)
  const [customDraft, setCustomDraft] = useState<{ projectId: string | null; pageId: string; pageName: string; baseline: string; html: string; css: string; js: string } | null>(null)
  const [showCustomPreview, setShowCustomPreview] = useState(false)
  const customPreviewAvailable = window.location.hostname !== 'webstudio.local'
  const [editValue, setEditValue] = useState('')
  const [editBaseline, setEditBaseline] = useState<{ projectId: string | null; config: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const jsonStr = JSON.stringify(config, null, 2)
  const highlighted = syntaxHighlight(jsonStr)
  const importedFiles: { path: string; text: string }[] = Array.isArray(projectFile?.webstudioStaticSource)
    ? projectFile.webstudioStaticSource.filter((item): item is { path: string; text: string } => !!item && typeof item === 'object' && typeof item.path === 'string' && typeof item.text === 'string')
    : []
  if (typeof projectFile?.webstudioWordPressSource === 'string') importedFiles.push({ path: 'WordPress export.xml', text: projectFile.webstudioWordPressSource })
  if (projectFile?.webstudioStaticImportReport && typeof projectFile.webstudioStaticImportReport === 'object') importedFiles.push({ path: 'HTML import report.json', text: JSON.stringify(projectFile.webstudioStaticImportReport, null, 2) })
  const importedView = importedSelection?.projectId === activeProjectId ? importedSelection : null

  function startEditing() {
    setEditValue(jsonStr)
    setEditBaseline({ projectId: activeProjectId, config: jsonStr })
    setError(null)
    setEditing(true)
  }

  function applyEdit() {
    try {
      if (!editBaseline || useEditorStore.getState().activeProjectId !== editBaseline.projectId || JSON.stringify(useConfigStore.getState().config, null, 2) !== editBaseline.config) {
        setError('The project changed while editing. Copy your draft, cancel, and reopen JSON before applying it.')
        return
      }
      const parsed = JSON.parse(editValue)
      if (!parsed.name || (!Array.isArray(parsed.blocks) && !Array.isArray(parsed.pages))) {
        setError('Invalid config: must have "name" and "blocks" or "pages" array')
        return
      }
      replaceConfig(validateProjectConfig(parsed))
      setEditing(false)
      setEditBaseline(null)
      setError(null)
      toast('Config updated from JSON')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function cancelEdit() {
    setEditing(false)
    setEditBaseline(null)
    setError(null)
  }

  function inspectPageSource() {
    try {
      const page = config.pages?.find(item => item.id === activePageId)
      const pageSettings = { ...settings, ...(page?.webstudioSeo?.title?.trim() ? { seoTitle: page.webstudioSeo.title } : {}), ...(page?.webstudioSeo?.description?.trim() ? { seoDescription: page.webstudioSeo.description } : {}) }
      setPageSource(exportSiteToHTML({ ...config, name: page?.name ?? config.name, blocks: page?.blocks ?? config.blocks }, { settings: pageSettings }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Page source could not be generated')
    }
  }

  function editCustomCode() {
    const page = config.pages?.find(item => item.id === activePageId)
    if (!page) { toast.error('Select a page first'); return }
    const code = page.webstudioCustomCode ?? { html: '', css: '', js: '' }
    setCustomDraft({ projectId: activeProjectId, pageId: page.id, pageName: page.name, baseline: JSON.stringify(page.webstudioCustomCode ?? null), ...code })
    setShowCustomPreview(false)
  }

  function applyCustomCode() {
    if (!customDraft) return
    const current = useConfigStore.getState().config
    const page = current.pages?.find(item => item.id === customDraft.pageId)
    if (useEditorStore.getState().activeProjectId !== customDraft.projectId || !page || JSON.stringify(page.webstudioCustomCode ?? null) !== customDraft.baseline) {
      toast.error('This page or its custom code changed. Copy your draft before cancelling and reopening the editor.')
      return
    }
    const next = structuredClone(current)
    next.pages!.find(item => item.id === customDraft.pageId)!.webstudioCustomCode = { ...page.webstudioCustomCode, html: customDraft.html, css: customDraft.css, js: customDraft.js }
    replaceConfig(validateProjectConfig(next), 'Edit custom page code')
    setCustomDraft(null)
    setShowCustomPreview(false)
    toast('Custom code applied; save the project to keep it')
  }

  return (
    <div
      id="editor-code-panel"
      role="region"
      aria-label="Site code panel"
      aria-hidden={!jsonDrawerOpen}
      inert={!jsonDrawerOpen}
      className={`bg-bg-0 flex flex-col overflow-hidden transition-all duration-250 ease-in-out ${jsonDrawerOpen ? 'border-t border-border-default' : ''}`}
      style={{ height: jsonDrawerOpen ? (customDraft ? '420px' : '220px') : '0px' }}
    >
      {/* Header */}
      <div
        className="h-8 min-h-8 bg-bg-1 border-b border-border-default flex items-center px-3 text-[11px] text-text-2 gap-2 select-none"
      >
        <span className="font-mono">{'{ }'}</span>
        <span>{customDraft ? `Custom code: ${customDraft.pageName}` : importedView ? 'Imported source' : pageSource === null ? 'Site Config' : 'Page HTML source'}</span>

        <div className="ml-auto flex items-center gap-2">
          {!editing && !customDraft && !importedView && pageSource === null && <button onClick={(e) => { e.stopPropagation(); editCustomCode() }} className="text-[10px] text-text-3 hover:text-green transition-colors">Custom HTML/CSS/JS</button>}
          {!editing && !customDraft && !importedView && pageSource === null && <button onClick={(e) => { e.stopPropagation(); inspectPageSource() }} className="text-[10px] text-text-3 hover:text-green transition-colors">Inspect page HTML</button>}
          {!editing && !customDraft && !importedView && pageSource === null && importedFiles.length > 0 && <button onClick={() => setImportedSelection({ projectId: activeProjectId, index: 0 })} className="text-[10px] text-text-3 hover:text-green transition-colors">Inspect imported source</button>}
          {pageSource !== null && <button onClick={(e) => { e.stopPropagation(); setPageSource(null) }} className="text-[10px] text-text-3 hover:text-green transition-colors">Back to JSON</button>}
          {importedView && <button onClick={() => setImportedSelection(null)} className="text-[10px] text-text-3 hover:text-green transition-colors">Back to JSON</button>}
          {!editing && !customDraft && !importedView && pageSource === null && (
            <button
              onClick={(e) => { e.stopPropagation(); startEditing() }}
              className="text-[10px] text-text-3 hover:text-green transition-colors"
            >
              Edit
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); applyEdit() }}
                className="text-[10px] text-green hover:text-green-dim transition-colors font-medium"
              >
                Apply
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); cancelEdit() }}
                className="text-[10px] text-text-3 hover:text-status-red transition-colors"
              >
                Cancel
              </button>
            </>
          )}
          <div className="flex items-center gap-1 text-[10px] text-green">
            <span className="w-1.5 h-1.5 rounded-full bg-green" />
            Live
          </div>
          <button type="button" aria-label="Close code panel" onClick={() => { toggleJsonDrawer(); document.querySelector<HTMLButtonElement>('[aria-controls="editor-code-panel"]')?.focus() }} className="text-[10px] text-text-2 hover:text-text-0">Close</button>
        </div>
      </div>

      {/* JSON body */}
      <div className="flex-1 overflow-auto px-3.5 py-2.5 font-mono text-[11.5px] leading-relaxed text-text-1">
        {customDraft ? (
          <div className="flex flex-col gap-2">
            <p className="text-status-yellow">Only use code you trust. Exported HTML and JavaScript can run in visitors' browsers. {customPreviewAvailable ? 'Preview disables scripts and isolates the content.' : 'Custom code preview is unavailable in the desktop app; inspect the exported website separately.'}</p>
            {(['html', 'css', 'js'] as const).map(field => <label key={field} className="flex flex-col gap-1">{field.toUpperCase()}<textarea aria-label={`Custom ${field.toUpperCase()}`} value={customDraft[field]} onChange={event => setCustomDraft({ ...customDraft, [field]: event.target.value })} className="h-20 w-full bg-bg-2 border border-border-default rounded p-1 font-mono" spellCheck={false} /></label>)}
            <div className="flex gap-3"><button onClick={applyCustomCode}>Apply custom code</button>{customPreviewAvailable && <button onClick={() => setShowCustomPreview(true)}>Preview HTML/CSS</button>}<button onClick={() => { setCustomDraft(null); setShowCustomPreview(false) }}>Cancel draft</button></div>
            {showCustomPreview && <iframe title="Sandboxed custom code preview" sandbox="" className="w-full h-48 bg-white" srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src data: 'unsafe-inline'; img-src data: blob:; font-src data:"><link rel="stylesheet" href="data:text/css;charset=utf-8,${encodeURIComponent(customDraft.css)}">${customDraft.html}`} />}
          </div>
        ) : importedView ? (
          <div className="h-full flex flex-col gap-1">
            <p className="text-text-2">Read-only retained source and import report. They are not executed here and may contain private information.</p>
            <label>Imported source file <select aria-label="Imported source file" value={importedView.index} onChange={event => setImportedSelection({ projectId: activeProjectId, index: Number(event.target.value) })} className="bg-bg-2 text-text-1">{importedFiles.map((file, index) => <option key={index} value={index}>{file.path}</option>)}</select></label>
            <textarea aria-label="Imported source text" readOnly value={importedFiles[importedView.index]?.text ?? ''} className="flex-1 w-full bg-transparent text-text-1 outline-none resize-none font-mono" spellCheck={false} />
          </div>
        ) : pageSource !== null ? (
          <div className="h-full flex flex-col gap-1">
            <p className="text-text-2">Generated page source snapshot. Site ZIP export adds navigation and custom code and adjusts links; export the site to inspect its final files.</p>
            <textarea aria-label="Generated page HTML source" readOnly value={pageSource} className="flex-1 w-full bg-transparent text-text-1 outline-none resize-none font-mono" spellCheck={false} />
          </div>
        ) : editing ? (
          <div className="h-full flex flex-col">
            <textarea
              aria-label="Site configuration JSON"
              aria-invalid={!!error}
              aria-describedby={error ? 'site-json-error' : undefined}
              value={editValue}
              onChange={(e) => { setEditValue(e.target.value); setError(null) }}
              className="flex-1 w-full bg-transparent text-text-1 outline-none resize-none font-mono text-[11.5px] leading-relaxed"
              spellCheck={false}
            />
            {error && (
              <div id="site-json-error" role="alert" className="text-status-red text-[10px] mt-1 py-1">
                {error}
              </div>
            )}
          </div>
        ) : (
          <pre dangerouslySetInnerHTML={{ __html: highlighted }} />
        )}
      </div>
    </div>
  )
}
