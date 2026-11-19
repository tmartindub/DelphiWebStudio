import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { acceptSiteActions, previewSiteActions, type SiteAction, type SiteActionPreview } from '@/ai/site-actions'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'

const choices = [
  { name: 'About', path: '/about' },
  { name: 'News', path: '/news' },
  { name: 'Events', path: '/events' },
  { name: 'Contact', path: '/contact' },
]

export function PlanPages({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const config = useConfigStore(state => state.config)
  const [selected, setSelected] = useState<string[]>([])
  const [preview, setPreview] = useState<{ result: SiteActionPreview; projectId: string | null } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [])

  function review() {
    try {
      const operations: SiteAction[] = choices.filter(choice => selected.includes(choice.path)).map(choice => ({
        op: 'createPage', pageId: `page-${crypto.randomUUID()}`, name: choice.name, path: choice.path,
      }))
      const result = previewSiteActions(useConfigStore.getState().config, { schemaVersion: 1, requestId: crypto.randomUUID(), mode: 'preview', operations })
      setPreview({ result, projectId: useEditorStore.getState().activeProjectId })
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The page plan could not be reviewed.')
    }
  }

  function apply() {
    if (!preview) return
    try {
      if (!preview.projectId || useEditorStore.getState().activeProjectId !== preview.projectId) throw new Error('The active project changed. Review your plan again.')
      const store = useConfigStore.getState()
      store.replaceConfig(acceptSiteActions(store.config, preview.result), 'Add planned pages')
      toast.success('Pages added. You can undo this change.')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The plan could not be applied.')
      setPreview(null)
    }
  }

  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose() }} aria-labelledby="plan-pages-title" className="w-[min(92vw,32rem)] rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
      <h2 id="plan-pages-title" className="text-lg font-semibold">Plan pages</h2>
      <p className="mt-2 text-sm text-text-2">Choose the blank pages you want to add. You can review the list before anything changes.</p>
      <div className="mt-4 space-y-2">
        {choices.map(choice => {
          const exists = (config.pages ?? []).some(page => page.path.toLowerCase() === choice.path)
          return <label key={choice.path} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(choice.path)} disabled={exists || !!preview} onChange={event => { setSelected(current => event.target.checked ? [...current, choice.path] : current.filter(path => path !== choice.path)); setError('') }} />
            <span>{choice.name} <span className="text-text-3">({choice.path}){exists ? ' - already exists' : ''}</span></span>
          </label>
        })}
      </div>
      {preview && <div className="mt-4 rounded border border-border-default bg-bg-2 p-3" aria-live="polite">
        <h3 className="font-semibold">Review changes</h3>
        <ul className="mt-2 list-disc pl-5 text-sm">{choices.filter(choice => selected.includes(choice.path)).map(choice => <li key={choice.path}>Add blank {choice.name} page at {choice.path}</li>)}</ul>
        <p className="mt-2 text-xs text-text-2">Existing pages and content stay in place. This change can be undone.</p>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm text-status-red">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded border border-border-default px-3 py-2 text-sm">Cancel</button>
        {preview ? <><button type="button" onClick={() => { setPreview(null); setError('') }} className="rounded border border-border-default px-3 py-2 text-sm">Change selection</button><button type="button" onClick={apply} className="rounded bg-green px-3 py-2 text-sm font-semibold text-black">Add pages</button></> : <button type="button" disabled={!selected.length} onClick={review} className="rounded bg-green px-3 py-2 text-sm font-semibold text-black disabled:opacity-40">Review plan</button>}
      </div>
    </dialog>
  )
}
