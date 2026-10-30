import { toast } from 'sonner'
import type { PageConfig } from '@/blocks/types'
import { validateProjectConfig } from '@/project/project-file'
import { useConfigStore } from '@/store/configStore'

export function ArticlesPanel() {
  const config = useConfigStore(state => state.config)
  const activePageId = useConfigStore(state => state.activePageId)
  const page = config.pages?.find(item => item.id === activePageId)
  const article = page?.webstudioArticle

  function updateArticle(changes: Partial<NonNullable<PageConfig['webstudioArticle']>>) {
    const state = useConfigStore.getState()
    const current = state.config.pages?.find(item => item.id === state.activePageId)
    if (!current || current.path === '/') return
    const now = new Date().toISOString()
    const metadata = { status: 'draft' as const, author: '', summary: '', createdAt: now, ...current.webstudioArticle, ...changes, modifiedAt: now }
    try {
      const pages = state.config.pages!.map(item => item.id === current.id ? { ...item, webstudioArticle: metadata } : item)
      state.replaceConfig(validateProjectConfig({ ...state.config, pages }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Article could not be updated.')
    }
  }

  if (!page || page.path === '/') return <div className="p-3 text-xs text-text-1">Create or select a non-Home page to use it as an article.</div>
  if (!article) return <div className="p-3 space-y-3 text-xs text-text-1">
    <p>Use the selected page as an article. Its existing content stays on the page.</p>
    <button type="button" onClick={() => updateArticle({})} className="px-3 py-2 rounded bg-green text-black font-semibold">Make this page an article</button>
  </div>

  return <div className="p-3 space-y-3 overflow-y-auto text-xs text-text-1">
    <p className="font-semibold text-text-0">Article: {page.name}</p>
    <p>Page path: {page.path}</p>
    <label className="block">Export status
      <select aria-label="Article export status" value={article.status} onChange={event => updateArticle({ status: event.target.value as 'draft' | 'ready' })} className="block w-full mt-1 p-2 rounded bg-bg-2 border border-border-default">
        <option value="draft">Draft — omit from website ZIP</option>
        <option value="ready">Ready — include in website ZIP</option>
      </select>
    </label>
    <label className="block">Author
      <input aria-label="Article author" value={article.author} onChange={event => updateArticle({ author: event.target.value })} className="block w-full mt-1 p-2 rounded bg-bg-2 border border-border-default" />
    </label>
    <label className="block">Summary
      <textarea aria-label="Article summary" value={article.summary} onChange={event => updateArticle({ summary: event.target.value })} rows={3} className="block w-full mt-1 p-2 rounded bg-bg-2 border border-border-default" />
    </label>
    <p>Edit the article content with the page components. Ready includes it in the ZIP; it does not publish the site.</p>
  </div>
}
