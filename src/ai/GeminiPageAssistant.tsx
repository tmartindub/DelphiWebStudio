import { GeminiEditAssistant } from './GeminiEditAssistant'
import { AIPagePreview } from './AIPagePreview'
import { ProjectMediaLibrary } from '@/media/media-library'
import type { EditMedia } from './gemini-edits'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { GEMINI_TEXT_MODEL } from '@/lib/gemini-text'
import { acceptCreation, generatePageBlueprint, geminiPageSession, previewCreation, type CreationOptions, type PageBlueprint } from './gemini-pages'
import type { SiteConfig } from '@/blocks/types'
import { requestGeminiCredential } from '@/desktop/native-bridge'

export function GeminiPageAssistant({ onClose }: { onClose: () => void }) {
  const [task, setTask] = useState<'create' | 'edit' | null>(null)
  const [connection, setConnection] = useState<'checking' | 'saved' | 'missing' | 'unavailable' | 'unknown'>('checking')
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef(document.activeElement)
  useEffect(() => {
    let active = true
    void requestGeminiCredential('read').then(key => {
      if (active) setConnection(key === null ? 'unavailable' : key ? 'saved' : 'missing')
    }).catch(() => { if (active) setConnection('unknown') })
    return () => {
      active = false
      queueMicrotask(() => { if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus({ preventScroll: true }) })
    }
  }, [])
  useEffect(() => { if (task === null) dialog.current?.showModal() }, [task])
  const header = (busy: boolean) => <header className="sticky top-0 z-20 space-y-3 border-b border-slate-300 bg-slate-50 px-5 py-4">
    <div className="flex items-start justify-between gap-3"><div><h2 id="gemini-assistant-title" className="text-xl font-semibold text-slate-900">AI Assistant</h2><p className="mt-1 text-sm text-slate-600">{task === null ? 'What would you like to do?' : task === 'create' ? 'Create a new page or section.' : 'Change content that is already on your site.'}</p></div><button type="button" aria-label="Close AI Assistant" className="rounded border border-slate-400 px-3 py-1.5 text-sm hover:bg-white" onClick={onClose}>×</button></div>
    <div role="group" aria-label="AI task" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(['create', 'edit'] as const).map(kind => <button key={kind} type="button" aria-label={kind === 'create' ? 'Create' : 'Edit existing content'} aria-pressed={task === kind} disabled={busy} className={`rounded-lg border-2 px-4 text-left disabled:opacity-50 ${task === null ? 'py-5' : 'py-2.5'} ${task === kind ? 'border-blue-800 bg-blue-800 text-white' : 'border-slate-300 bg-white text-slate-900 hover:border-blue-700 hover:bg-blue-50'}`} onClick={() => setTask(kind)}><span className="block text-base font-semibold">{kind === 'create' ? 'Create' : 'Edit existing content'}</span>{task === null && <span className="mt-1 block text-sm text-slate-600">{kind === 'create' ? 'Add a new page or section.' : 'Change a page, panel, text box or other item.'}</span>}</button>)}
    </div>
    <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-slate-600"><span aria-live="polite">Google connection: <strong className={connection === 'saved' ? 'text-green-800' : 'text-slate-700'}>{connection === 'checking' ? 'Checking saved key…' : connection === 'saved' ? 'Key saved' : connection === 'missing' ? 'Setup needed' : connection === 'unavailable' ? 'Windows app required' : 'Check setup'}</strong></span><details className="max-w-xl"><summary className="cursor-pointer text-blue-800 underline">Connection details</summary><p className="mt-2 leading-relaxed">Google Gemini · {GEMINI_TEXT_MODEL}. Save your Google API key in Settings → Application settings → Application-wide AI connection. A saved key does not confirm model access or billing status. Requests use the saved Windows key and the sharing confirmations below. No paid fallback is used.</p></details></div>
  </header>
  if (task === 'edit') return <GeminiEditAssistant onClose={onClose} header={header} />
  if (task === 'create') return <GeminiCreationAssistant onClose={onClose} header={header} />
  return <dialog ref={dialog} data-studio-window aria-labelledby="gemini-assistant-title" className="m-auto max-h-[calc(100dvh-24px)] w-[min(760px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-slate-500 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/45" onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => event.stopPropagation()}>
    {header(false)}
    <p className="px-5 py-6 text-sm leading-relaxed text-slate-600">Choose a task to begin. You will describe what you want, review a preview and decide whether to apply it.</p>
    <footer className="flex justify-end border-t border-slate-300 px-5 py-3"><button type="button" className="rounded border border-slate-500 px-4 py-2 text-sm" onClick={onClose}>Close</button></footer>
  </dialog>
}

function GeminiCreationAssistant({ onClose, header }: { onClose: () => void; header: (busy: boolean) => ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null), request = useRef<AbortController | null>(null)
  const projectId = useRef(useEditorStore.getState().activeProjectId)
  const targetPageId = useRef(useConfigStore.getState().activePageId)
  const afterBlockId = useRef(useEditorStore.getState().selectedBlockId)
  const appliedConfig = useRef<SiteConfig | null>(null)
  const config = useConfigStore(state => state.config)
  const [mode, setMode] = useState<CreationOptions['mode']>('page')
  const [referencePageId, setReferencePageId] = useState(targetPageId.current)
  const [includeNavigation, setIncludeNavigation] = useState(true)
  const [media, setMedia] = useState<EditMedia[]>([]), [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [allowMedia, setAllowMedia] = useState(false)
  useEffect(() => {
    const id = projectId.current; if (!id) return
    const library = new ProjectMediaLibrary(), urls: string[] = []; let active = true
    void library.list(id).then(assets => {
      if (!active) return
      const images = assets.filter(asset => asset.mime.startsWith('image/')), mapped: Record<string, string> = {}
      setMedia(images.map(({ id, name, path, mime, folder, width, height }) => ({ id, name, path, mime, folder, width, height })))
      for (const image of images) { const url = URL.createObjectURL(image.content); urls.push(url); mapped[image.path] = url }
      setAssetUrls(mapped)
    }).catch(() => undefined)
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); library.close() }
  }, [])
  const [instruction, setInstruction] = useState('')
  const [facts, setFacts] = useState('')
  const [consent, setConsent] = useState(geminiPageSession.consent), [freeTier, setFreeTier] = useState(geminiPageSession.freeTierConfirmed)
  const [busy, setBusy] = useState(false), [applied, setApplied] = useState(false), [error, setError] = useState('')
  const [result, setResult] = useState<{ base: SiteConfig; options: CreationOptions; plan: PageBlueprint } | null>(null)
  const [details, setDetails] = useState({ name: '', path: '' }), [previewWidth, setPreviewWidth] = useState(1200)
  useEffect(() => {
    const previous = document.activeElement; dialog.current?.showModal()
    return () => { request.current?.abort(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  const review = useMemo(() => {
    if (!result) return { proposal: null, error: '' }
    try { return { proposal: previewCreation(result.base, result.plan, result.options, result.options.mode === 'page' ? details : undefined), error: '' } }
    catch (failure) { return { proposal: null, error: failure instanceof Error ? failure.message : 'This proposal could not be reviewed.' } }
  }, [result, details])
  const reset = () => { setResult(null); setError('') }
  const close = () => { request.current?.abort(); onClose() }
  const fieldClass = 'mt-1 w-full rounded border border-slate-500 bg-white p-2 text-sm text-slate-900 disabled:opacity-60'
  const buttonClass = 'rounded border border-slate-500 px-3 py-2 text-sm disabled:opacity-40'
  const targetName = config.pages?.find(page => page.id === targetPageId.current)?.name ?? 'current page'
  return <dialog ref={dialog} data-studio-window aria-labelledby="gemini-assistant-title" className="m-auto max-h-[calc(100dvh-24px)] w-[min(1160px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-slate-500 bg-white p-0 text-sm text-slate-900 shadow-2xl backdrop:bg-slate-950/45" onCancel={event => { event.preventDefault(); close() }} onKeyDown={event => event.stopPropagation()}>
    {header(busy)}
    <div className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>Create<select aria-label="AI creation type" value={mode} disabled={busy || applied} onChange={event => { setMode(event.target.value as CreationOptions['mode']); reset() }} className={fieldClass}><option value="page">A new page</option><option value="section">A section on {targetName}</option></select></label>
        <label>Match this page<select aria-label="AI reference page" value={referencePageId} disabled={busy || applied} onChange={event => { setReferencePageId(event.target.value); reset() }} className={fieldClass}>{config.pages?.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label>
      </div>
      <label className="block font-semibold">What would you like to create?<textarea autoFocus aria-label="AI page request" maxLength={3000} value={instruction} disabled={busy || applied} onChange={event => { setInstruction(event.target.value); reset() }} className={`${fieldClass} min-h-20 font-normal`} /></label>
      <p className="text-xs leading-relaxed text-slate-600"><strong>Example:</strong> {mode === 'page' ? 'Create a staff directory matching Home, with six editable portrait spaces and biographies.' : 'Add a welcoming section with three panels for visitors, events and volunteering.'}</p>
      <details><summary className="cursor-pointer text-sm font-semibold">Facts and wording to use (optional)</summary><textarea aria-label="AI supporting facts" maxLength={12000} value={facts} disabled={busy || applied} onChange={event => { setFacts(event.target.value); reset() }} placeholder="Paste the names, descriptions or other facts the assistant should use. Missing facts will use editable placeholders." className={`${fieldClass} min-h-24`} /></details>
      {mode === 'page' && <label className="flex items-center gap-2"><input type="checkbox" checked={includeNavigation} disabled={busy || applied} onChange={event => { setIncludeNavigation(event.target.checked); reset() }} />Copy the reference page’s Navbar and Footer</label>}
      <label className="flex items-center gap-2"><input aria-label="Allow creation media catalog" type="checkbox" checked={allowMedia} disabled={busy || applied} onChange={event => { setAllowMedia(event.target.checked); reset() }} />Allow Gemini to choose from this project’s {media.length} images by filename and folder. Files stay local.</label>
      {mode === 'section' && <p className="text-xs text-slate-600">The section will be added after the selected block, or before the footer. Existing content stays in place.</p>}
      {result && <>
        {mode === 'page' && <div className="grid gap-4 sm:grid-cols-2"><label>Proposed page name<input aria-label="AI proposed page name" value={details.name} disabled={applied} onChange={event => setDetails({ ...details, name: event.target.value })} className={fieldClass} /></label><label>Proposed page address<input aria-label="AI proposed page address" value={details.path} disabled={applied} onChange={event => setDetails({ ...details, path: event.target.value })} className={fieldClass} /></label></div>}
        {review.proposal && <><ul aria-label="Proposed AI changes" className="list-inside list-disc rounded border border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed">{review.proposal.changes.map(change => <li key={change}>{change}</li>)}</ul>
          <div className="flex flex-wrap items-center gap-2"><strong>Content preview</strong>{[[1200, 'Desktop'], [768, 'Tablet'], [390, 'Phone']].map(([width, label]) => <button key={width} type="button" aria-pressed={previewWidth === width} className={`${buttonClass} ${previewWidth === width ? 'bg-blue-100' : ''}`} onClick={() => setPreviewWidth(Number(width))}>{label}</button>)}</div>
          <AIPagePreview config={{ ...review.proposal.config, pages: [{ id: review.proposal.pageId, name: "Proposal", path: "/", blocks: review.proposal.blocks }], blocks: review.proposal.blocks }} pageId={review.proposal.pageId} width={previewWidth} label="AI content preview" assetUrls={assetUrls} /></>}
        <p className="text-xs text-slate-600">Photos use approved existing media when selected; other photo spaces remain editable placeholders. After Apply, edit all components normally and add a visitor navigation link when the page is ready.</p>
      </>}
      {(error || review.error) && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error || review.error}</p>}
      {applied && <p role="status" className="rounded border border-green-300 bg-green-50 p-3">Added to your project. Undo removes this addition and restores the previous page selection. Nothing has been published.</p>}
      {!applied && <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed">
        <p className="font-semibold">Before sending this request</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={freeTier} disabled={busy} onChange={event => { setFreeTier(event.target.checked); geminiPageSession.freeTierConfirmed = event.target.checked }} className="mt-1" />I confirm this key’s Google project is Free tier with billing disabled. Google controls billing; the app cannot verify it. No paid fallback is used.</label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={consent} disabled={busy} onChange={event => { setConsent(event.target.checked); geminiPageSession.consent = event.target.checked }} className="mt-1" />Send my request, supplied facts, the chosen reference page’s text and style, and the site’s page names and addresses to Google. Media files, credentials and other pages’ contents are excluded. Free-tier content may be used to improve Google’s products.</label>
      </div>}
    </div>
    <footer className="sticky bottom-0 z-20 flex flex-wrap justify-end gap-2 border-t border-slate-300 bg-white px-5 py-3">
      {!applied && (busy ? <button type="button" className={buttonClass} onClick={() => request.current?.abort()}>Stop</button> : <button type="button" className="rounded bg-blue-800 px-4 py-2 font-semibold text-white disabled:opacity-40" disabled={!consent || !freeTier || !instruction.trim()} onClick={async () => {
        document.querySelectorAll('[data-rich-editor]').forEach(element => element.dispatchEvent(new Event('webstudio-flush-text')))
        const current = useConfigStore.getState(), base = structuredClone(current.config)
        const options: CreationOptions = { mode, referencePageId, targetPageId: targetPageId.current, afterBlockId: afterBlockId.current, includeNavigation, media: allowMedia ? media : [] }
        const controller = new AbortController(); request.current = controller; setBusy(true); setError(''); setResult(null)
        try {
          if (allowMedia && media.length > 500) throw new Error('Use Edit existing content and choose a media folder; this catalog has more than 500 images.')
          if (useEditorStore.getState().activeProjectId !== projectId.current) throw new Error('The active project changed. Reopen the assistant.')
          const plan = await generatePageBlueprint(base, options, instruction, facts, { consent, freeTierConfirmed: freeTier, signal: controller.signal })
          if (!controller.signal.aborted) { setDetails({ name: plan.name, path: plan.path }); setResult({ base, options, plan }) }
        } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The proposal could not be prepared.') }
        finally { if (request.current === controller) { request.current = null; setBusy(false) } }
      }}>{result ? 'New preview' : 'Preview new content'}</button>)}
      {result && !applied && <button type="button" disabled={!review.proposal || busy} className="rounded bg-orange-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40" onClick={() => {
        if (!review.proposal) return
        try { if (useEditorStore.getState().activeProjectId !== projectId.current) throw new Error('The active project changed. Reopen the assistant.'); const store = useConfigStore.getState(); store.replaceConfig(acceptCreation(store.config, review.proposal), mode === 'page' ? 'Gemini: add page' : 'Gemini: add section'); store.setActivePage(review.proposal.pageId); useEditorStore.getState().selectBlock(null); appliedConfig.current = useConfigStore.getState().config; setApplied(true); setError('') }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'The proposal could not be applied.') }
      }}>Apply</button>}
      {applied && <button type="button" className={buttonClass} onClick={() => { try { const store = useConfigStore.getState(); if (store.config !== appliedConfig.current) throw new Error('Other edits have been made. Review them in the editor’s Undo history.'); store.undo(); useEditorStore.getState().selectBlock(null); close() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Undo is unavailable.') } }}>Undo</button>}
      <button type="button" className={buttonClass} onClick={close}>Close</button>
    </footer>
  </dialog>
}
