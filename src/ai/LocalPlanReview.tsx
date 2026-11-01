import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { acceptSiteActions, previewFivePagePlan, type SiteActionPreview } from './site-actions'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'

export function LocalPlanReview() {
  const pending = useRef<{ requestId: string; projectId: string; snapshot: string } | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [proposal, setProposal] = useState<{ projectId: string; result: SiteActionPreview } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    function started(event: Event) {
      const requestId: unknown = (event as CustomEvent<unknown>).detail
      const projectId = useEditorStore.getState().activeProjectId
      if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(requestId) || !projectId) return
      pending.current = { requestId, projectId, snapshot: JSON.stringify(useConfigStore.getState().config) }
    }
    function completed(event: Event) {
      const value: unknown = (event as CustomEvent<unknown>).detail
      if (!value || typeof value !== 'object' || Array.isArray(value)) return
      const response = value as Record<string, unknown>
      const request = pending.current
      if (!request || response.requestId !== request.requestId) return
      pending.current = null
      try {
        if (useEditorStore.getState().activeProjectId !== request.projectId || JSON.stringify(useConfigStore.getState().config) !== request.snapshot) throw new Error('The project changed while the plan was generated. Generate a new plan.')
        const result = previewFivePagePlan(useConfigStore.getState().config, response.plan, request.requestId)
        setError('')
        setProposal({ projectId: request.projectId, result })
      } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'The plan could not be reviewed.') }
    }
    function cancelled(event: Event) {
      if ((event as CustomEvent<unknown>).detail === pending.current?.requestId) pending.current = null
    }
    window.addEventListener('webstudio-local-plan-started', started)
    window.addEventListener('webstudio-local-plan-completed', completed)
    window.addEventListener('webstudio-local-plan-cancelled', cancelled)
    return () => {
      window.removeEventListener('webstudio-local-plan-started', started)
      window.removeEventListener('webstudio-local-plan-completed', completed)
      window.removeEventListener('webstudio-local-plan-cancelled', cancelled)
    }
  }, [])

  useEffect(() => {
    if (!proposal) return
    const element = dialog.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [proposal])

  function apply() {
    if (!proposal) return
    try {
      if (useEditorStore.getState().activeProjectId !== proposal.projectId) throw new Error('The active project changed. Generate a new plan.')
      const store = useConfigStore.getState()
      store.replaceConfig(acceptSiteActions(store.config, proposal.result), 'Apply local AI plan')
      setProposal(null)
      toast.success('Pages created. You can undo this change.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The plan could not be applied.') }
  }

  if (!proposal) return null
  return <dialog ref={dialog} aria-labelledby="local-plan-review-title" onCancel={event => { event.preventDefault(); setProposal(null) }} className="w-[min(92vw,38rem)] max-h-[85vh] overflow-auto rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
    <h2 id="local-plan-review-title" className="text-lg font-semibold">Review the proposed site</h2>
    <p className="mt-2 text-sm text-text-2">Review the page names and headlines. Nothing changes until you choose Apply, and you can undo the result.</p>
    <ol className="mt-4 space-y-3">{proposal.result.proposedConfig.pages?.map(page => <li key={page.id} className="rounded border border-border-default bg-bg-2 p-3">
      <p className="font-semibold">{page.name} <span className="font-normal text-text-3">({page.path})</span></p>
      <p className="mt-1 text-sm">{String(page.blocks.find(block => block.type === 'hero')?.props.headline ?? '')}</p>
    </li>)}</ol>
    {error && <p role="alert" className="mt-3 text-sm text-status-red">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setProposal(null)} className="rounded border border-border-default px-3 py-2 text-sm">Cancel</button><button type="button" onClick={apply} className="rounded bg-green px-3 py-2 text-sm font-semibold text-black">Apply plan</button></div>
  </dialog>
}
