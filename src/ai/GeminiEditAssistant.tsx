import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { acceptEdits, editTargets, refineEdits, type EditPreview, type EditScope, type EditMedia } from './gemini-edits'
import { generateEditPlan, type EditTurn } from './gemini-edit-request'
import { AIPagePreview } from './AIPagePreview'
import { geminiPageSession } from './gemini-pages'
import type { SiteConfig } from '@/blocks/types'
import { ProjectMediaLibrary } from '@/media/media-library'

export function GeminiEditAssistant({ onClose, header }: { onClose: () => void; header: (busy: boolean) => ReactNode }) {
  const config = useConfigStore(state => state.config)
  const initial = useRef(useEditorStore.getState()), projectId = initial.current.activeProjectId
  const [pageId, setPageId] = useState(useConfigStore.getState().activePageId)
  const [target, setTarget] = useState(() => {
    const selected = initial.current.selectedSectionObject
    const composite = initial.current.selectedCompositeItem
    if (composite) return editTargets(config, useConfigStore.getState().activePageId).find(item => item.kind === 'item' && item.blockId === composite.blockId && item.itemPath?.[0] === composite.field && item.itemPath?.[1] === composite.index)?.id ?? 'block:' + composite.blockId
    const placed = initial.current.selectedPlacedMedia
    if (placed) return editTargets(config, useConfigStore.getState().activePageId).find(item => item.kind === 'item' && item.blockId === placed.blockId && item.id.endsWith(':' + placed.id))?.id ?? 'block:' + placed.blockId
    return selected ? 'object:' + selected.blockId + ':' + selected.section + ':' + selected.id : initial.current.selectedBlockId ? 'block:' + initial.current.selectedBlockId : 'page:' + useConfigStore.getState().activePageId
  })
  const targets = editTargets(config, pageId), scope: EditScope = { pageId, target }
  const [instruction, setInstruction] = useState(''), [history, setHistory] = useState<EditTurn[]>([])
  const [proposal, setProposal] = useState<EditPreview | null>(null), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false), [width, setWidth] = useState(1200), [view, setView] = useState<'before' | 'after'>('after')
  const [consent, setConsent] = useState(false), [freeTier, setFreeTier] = useState(geminiPageSession.freeTierConfirmed)
  const dialog = useRef<HTMLDialogElement>(null), request = useRef<AbortController | null>(null), applied = useRef<SiteConfig | null>(null)
  const targetDetails = useRef<HTMLDetailsElement>(null), pageSelector = useRef<HTMLSelectElement>(null)
  const [canUndo, setCanUndo] = useState(false)
  const appliedTurns = useRef(new Set<EditTurn>())
  const [media, setMedia] = useState<EditMedia[]>([]), [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [allowMedia, setAllowMedia] = useState(false), [folder, setFolder] = useState('*')
  const catalog = allowMedia ? media.filter(item => folder === '*' || (item.folder ?? '') === folder) : []
  useEffect(() => {
    if (!projectId) return
    const library = new ProjectMediaLibrary(), urls: string[] = []; let active = true
    void library.list(projectId).then(assets => {
      if (!active) return
      const mapped: Record<string, string> = {}
      setMedia(assets.map(({ id, name, path, mime, folder, width, height }) => ({ id, name, path, mime, folder, width, height })))
      for (const asset of assets) { const url = URL.createObjectURL(asset.content); urls.push(url); mapped[asset.path] = url; mapped[asset.id] = url }
      setAssetUrls(mapped)
    }).catch(() => { if (active) setMessage('Project media could not be read. Text and layout assistance remain available.') })
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); library.close() }
  }, [projectId])
  useEffect(() => { const focus = document.activeElement; dialog.current?.showModal(); return () => { request.current?.abort(); if (focus instanceof HTMLElement && focus.isConnected) focus.focus({ preventScroll: true }) } }, [])
  const close = () => { request.current?.abort(); onClose() }
  const button = 'rounded border border-slate-500 px-3 py-2 text-sm disabled:opacity-40'
  const field = 'mt-1 w-full rounded border border-slate-500 bg-white p-2 text-sm text-slate-900 disabled:opacity-50'
  function reset() { setProposal(null); setError(''); setMessage(''); setHistory([]); applied.current = null; setCanUndo(false) }
  return <dialog ref={dialog} data-studio-window aria-labelledby="gemini-assistant-title" className="m-auto max-h-[calc(100dvh-24px)] w-[min(1160px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-slate-500 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/45" onCancel={event => { event.preventDefault(); close() }} onKeyDown={event => event.stopPropagation()}>
    {header(busy)}
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm"><p className="min-w-0 break-words"><strong>Editing:</strong> {config.pages?.find(page => page.id === pageId)?.name} → {targets.find(item => item.id === target)?.label ?? 'Component no longer exists'}</p><button type="button" disabled={busy} className={button + ' shrink-0'} onClick={() => { if (targetDetails.current) targetDetails.current.open = true; pageSelector.current?.focus() }}>Change selection</button></div>
      <details ref={targetDetails} open={!proposal}><summary className="cursor-pointer font-semibold">Request and target</summary><div className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2"><label>Page<select ref={pageSelector} aria-label="AI edit page" value={pageId} disabled={busy} className={field} onChange={event => { setPageId(event.target.value); setTarget('page:' + event.target.value); reset() }}>{config.pages?.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label>
          <label>Change this component<select aria-label="AI edit target" value={target} disabled={busy} className={field} onChange={event => { setTarget(event.target.value); reset() }}>{targets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
        <div className="space-y-2 rounded border border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed">
          <label className="flex gap-2"><input aria-label="Allow project media catalog" type="checkbox" disabled={busy} checked={allowMedia} onChange={event => setAllowMedia(event.target.checked)} />Allow the assistant to choose existing media by filename, folder and file type. Actual files stay on this computer.</label>
          {allowMedia && <label className="block">Media folder<select aria-label="AI media folder" value={folder} disabled={busy} onChange={event => setFolder(event.target.value)} className={field}><option value="*">All media ({media.length})</option>{[...new Set(media.map(item => item.folder ?? ''))].sort().map(name => <option key={name} value={name}>{name || 'Unfiled'}</option>)}</select><span>{catalog.length} files available; choose a folder if there are more than 500.</span></label>}
        </div>
      </div></details>
      <div><label className="block font-semibold">{proposal ? 'Refine this preview' : 'What would you like to change?'}<textarea aria-label="AI edit request" disabled={busy} maxLength={3000} value={instruction} onChange={event => setInstruction(event.target.value)} className={field + ' min-h-20 font-normal'} /></label><p className="mt-1 text-xs text-slate-600">Example: {proposal ? 'Make it smaller, and use a lighter blue.' : 'Make this panel narrower and change its background to light blue.'}</p></div>
      {history.length > 0 && <details><summary className="cursor-pointer text-sm font-semibold">Recent conversation ({history.length})</summary><ol className="mt-2 max-h-44 space-y-2 overflow-auto rounded border border-slate-300 p-3 text-sm">{history.map((turn, index) => <li key={index}><p className="font-semibold">You: {turn.request}</p><p className="whitespace-pre-wrap">{turn.result} <span className="text-xs text-slate-500">({turn.state})</span></p></li>)}</ol><button type="button" disabled={busy} className={button + ' mt-2'} onClick={() => setHistory([])}>Clear conversation</button></details>}
      {proposal && <><ul aria-label="AI edit changes" className="max-h-36 list-inside list-disc overflow-auto rounded border border-slate-300 bg-slate-50 p-3 text-sm">{proposal.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
        <div className="flex flex-wrap gap-2">{(['before', 'after'] as const).map(item => <button type="button" key={item} aria-pressed={view === item} className={button + (view === item ? ' bg-blue-100' : '')} onClick={() => setView(item)}>{item === 'before' ? 'Current page' : 'Proposed page'}</button>)}<span className="grow" />{[[1200, 'Desktop'], [768, 'Tablet'], [390, 'Phone']].map(([size, label]) => <button type="button" key={size} className={button + (width === size ? ' bg-blue-100' : '')} onClick={() => setWidth(Number(size))}>{label}</button>)}</div>
        <AIPagePreview config={view === 'after' ? proposal.config : JSON.parse(proposal.before)} pageId={pageId} width={width} label="AI edit visual preview" assetUrls={assetUrls} />
        <p className="text-xs text-slate-600">This is a read-only visual review. The project changes only after Apply. Shared-section changes are listed explicitly.</p>
      </>}
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {message && <p role="status" className="rounded border border-green-300 bg-green-50 p-3">{message}</p>}
      <div className="space-y-2 rounded border border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed">
        <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={freeTier} onChange={event => { setFreeTier(event.target.checked); geminiPageSession.freeTierConfirmed = event.target.checked }} />This saved key uses Free tier with billing disabled. Google controls billing; the app cannot verify it. No paid fallback is used.</label>
        <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={consent} onChange={event => setConsent(event.target.checked)} />Send this target’s listed properties and text, plus this window’s recent requests and results, to Google. Selecting the whole page includes its components. Media files and saved connection settings are excluded. Free-tier content may improve Google’s products.</label>
      </div>
    </div>
    <footer className="sticky bottom-0 z-20 flex flex-wrap justify-end gap-2 border-t border-slate-300 bg-white px-5 py-3">
      {proposal && <button type="button" disabled={busy} className={button} onClick={() => { setProposal(null); setHistory(old => old.map(turn => turn.state === 'previewed' ? { ...turn, state: 'discarded' } : turn)); setMessage('Preview discarded. Your project is unchanged.'); setError('') }}>Discard preview</button>}
      {busy ? <button type="button" className={button} onClick={() => request.current?.abort()}>Stop</button> : <button type="button" className="rounded bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!instruction.trim() || !consent || !freeTier || !targets.some(item => item.id === target)} onClick={async () => {
        document.querySelectorAll('[data-rich-editor]').forEach(element => element.dispatchEvent(new Event('webstudio-flush-text')))
        const current = useConfigStore.getState().config, controller = new AbortController()
        setBusy(true); setError(''); setMessage(''); request.current = controller
        try {
          if (useEditorStore.getState().activeProjectId !== projectId) throw new Error('The active project changed. Reopen the assistant.')
          if (catalog.length > 500) throw new Error('Choose a media folder with at most 500 files.')
          if (proposal && JSON.stringify(current) !== proposal.before) throw new Error('The project changed. Discard this preview first.')
          const plan = await generateEditPlan(proposal?.config ?? current, scope, instruction, { consent, freeTierConfirmed: freeTier, history, signal: controller.signal, media: catalog })
          if (controller.signal.aborted) return
          if (!plan.operations.length) { setMessage(plan.summary); setHistory(old => [...old.slice(-11), { request: instruction, result: plan.summary, state: 'discarded' }]); return }
          const reviewed = refineEdits(current, scope, proposal, plan, catalog)
          setProposal(reviewed); setView('after'); setHistory(old => [...old.slice(-11), { request: instruction, result: plan.summary, state: 'previewed' }]); setInstruction('')
        } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The proposal could not be prepared.') }
        finally { if (request.current === controller) { request.current = null; setBusy(false) } }
      }}>{proposal ? 'Refine preview' : 'Preview changes'}</button>}
      {proposal && <button type="button" className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40" disabled={busy} onClick={() => {
        if (!proposal) return
        try { if (useEditorStore.getState().activeProjectId !== projectId) throw new Error('The active project changed.'); useConfigStore.getState().replaceConfig(acceptEdits(useConfigStore.getState().config, proposal), 'Gemini: edit website'); useConfigStore.getState().setActivePage(pageId); applied.current = useConfigStore.getState().config; setCanUndo(true); setProposal(null); setHistory(old => { const changed = old.map(turn => turn.state === 'previewed' ? { ...turn, state: 'applied' as const } : turn); appliedTurns.current = new Set(changed.filter((turn, index) => turn !== old[index])); return changed }); setMessage('Applied. Continue with another request, Undo, or close and save your project.'); setError(''); useEditorStore.getState().selectBlock(null) }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Apply failed.') }
      }}>Apply</button>}
      {canUndo && <button type="button" className={button} disabled={busy} onClick={() => {
        try { if (useConfigStore.getState().config !== applied.current) throw new Error('Other edits have been made. Use the editor’s Undo history.'); useConfigStore.getState().undo(); setCanUndo(false); applied.current = null; setProposal(null); setHistory(old => old.map(turn => appliedTurns.current.has(turn) ? { ...turn, state: 'undone' } : turn)); setMessage('The last applied request was undone.'); setError('') }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Undo failed.') }
      }}>Undo</button>}<button type="button" className={button} onClick={close}>Close</button>
    </footer>
  </dialog>
}
