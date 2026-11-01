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
  const [editing, setEditing] = useState(false)
  const [pageSource, setPageSource] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const jsonStr = JSON.stringify(config, null, 2)
  const highlighted = syntaxHighlight(jsonStr)

  function startEditing() {
    setEditValue(jsonStr)
    setError(null)
    setEditing(true)
  }

  function applyEdit() {
    try {
      const parsed = JSON.parse(editValue)
      if (!parsed.name || (!Array.isArray(parsed.blocks) && !Array.isArray(parsed.pages))) {
        setError('Invalid config: must have "name" and "blocks" or "pages" array')
        return
      }
      replaceConfig(validateProjectConfig(parsed))
      setEditing(false)
      setError(null)
      toast('Config updated from JSON')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function cancelEdit() {
    setEditing(false)
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

  return (
    <div
      className={`bg-bg-0 flex flex-col overflow-hidden transition-all duration-250 ease-in-out ${jsonDrawerOpen ? 'border-t border-border-default' : ''}`}
      style={{ height: jsonDrawerOpen ? '220px' : '0px' }}
    >
      {/* Header */}
      <div
        className="h-8 min-h-8 bg-bg-1 border-b border-border-default flex items-center px-3 text-[11px] text-text-2 gap-2 cursor-pointer select-none hover:bg-bg-2 transition-colors"
        onClick={toggleJsonDrawer}
      >
        <span className="font-mono">{'{ }'}</span>
        <span>{pageSource === null ? 'Site Config' : 'Page HTML source'}</span>

        <div className="ml-auto flex items-center gap-2">
          {!editing && pageSource === null && <button onClick={(e) => { e.stopPropagation(); inspectPageSource() }} className="text-[10px] text-text-3 hover:text-green transition-colors">Inspect page HTML</button>}
          {pageSource !== null && <button onClick={(e) => { e.stopPropagation(); setPageSource(null) }} className="text-[10px] text-text-3 hover:text-green transition-colors">Back to JSON</button>}
          {!editing && pageSource === null && (
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
        </div>
      </div>

      {/* JSON body */}
      <div className="flex-1 overflow-auto px-3.5 py-2.5 font-mono text-[11.5px] leading-relaxed text-text-1">
        {pageSource !== null ? (
          <div className="h-full flex flex-col gap-1">
            <p className="text-text-2">Generated page source snapshot. Site ZIP export adds navigation and adjusts links; export the site to inspect its final files.</p>
            <textarea aria-label="Generated page HTML source" readOnly value={pageSource} className="flex-1 w-full bg-transparent text-text-1 outline-none resize-none font-mono" spellCheck={false} />
          </div>
        ) : editing ? (
          <div className="h-full flex flex-col">
            <textarea
              value={editValue}
              onChange={(e) => { setEditValue(e.target.value); setError(null) }}
              className="flex-1 w-full bg-transparent text-text-1 outline-none resize-none font-mono text-[11.5px] leading-relaxed"
              spellCheck={false}
            />
            {error && (
              <div className="text-status-red text-[10px] mt-1 py-1">
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
