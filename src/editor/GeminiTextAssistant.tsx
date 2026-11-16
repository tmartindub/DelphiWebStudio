import { useEffect, useRef, useState } from 'react'
import { GEMINI_TEXT_MODEL, geminiTextSession, suggestSelectedText, type TextSegment } from '@/lib/gemini-text'

type Props = { segments: TextSegment[]; onApply: (segments: TextSegment[]) => void; onUndo: () => void; onClose: () => void }

export function GeminiTextAssistant({ segments, onApply, onUndo, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<AbortController | null>(null)
  const [instruction, setInstruction] = useState('Improve clarity and grammar while keeping the meaning and tone.')
  const [consent, setConsent] = useState(geminiTextSession.consent)
  const [freeTier, setFreeTier] = useState(geminiTextSession.freeTierConfirmed)
  const [suggestion, setSuggestion] = useState<TextSegment[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement
    dialog.current?.showModal()
    return () => { request.current?.abort(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  const showText = (items: TextSegment[]) => items.map((item, index) => `${index && item.breakBefore ? '\n\n' : ''}${item.text}`).join('')
  const dismiss = () => { request.current?.abort(); onClose() }
  return <dialog ref={dialog} data-rich-menu data-studio-window aria-labelledby="gemini-text-title" className="m-auto w-[min(900px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-xl border border-slate-500 bg-white p-0 text-sm text-slate-900 shadow-2xl backdrop:bg-slate-950/45" onCancel={event => { event.preventDefault(); dismiss() }} onKeyDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-300 bg-slate-50 px-5 py-3"><div><h2 id="gemini-text-title" className="text-lg font-semibold">Gemini · Help with selected text</h2><p className="mt-1 text-xs text-slate-600">{GEMINI_TEXT_MODEL} · Saved Windows key · Preview before changing your page</p></div><button type="button" aria-label="Close Gemini text assistant" className="ml-3 rounded border border-slate-400 px-2 py-1" onClick={dismiss}>×</button></header>
    <div className="space-y-4 p-5">
      <label className="block font-semibold">What would you like to improve?<textarea autoFocus aria-label="Gemini writing instruction" maxLength={1500} disabled={busy || applied} value={instruction} onChange={event => { setInstruction(event.target.value); setSuggestion(null); setError('') }} className="mt-2 block min-h-20 w-full rounded border border-slate-500 bg-white p-3 font-normal text-slate-900 disabled:opacity-60" /></label>
      <div className="flex flex-wrap gap-2" aria-label="Writing suggestions">{['Correct grammar and spelling.', 'Make this warmer and more welcoming.', 'Make this more professional.', 'Shorten this while preserving all important facts.'].map(prompt => <button key={prompt} type="button" disabled={busy || applied} className="rounded border border-slate-400 bg-slate-50 px-3 py-1.5 text-xs disabled:opacity-50" onClick={() => { setInstruction(prompt); setSuggestion(null); setError('') }}>{prompt.startsWith('Correct') ? 'Grammar' : prompt.includes('warmer') ? 'Warmer tone' : prompt.includes('professional') ? 'Professional tone' : 'Shorten'}</button>)}</div>
      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed">
        <label className="flex items-start gap-2"><input type="checkbox" checked={freeTier} disabled={busy || applied} onChange={event => { setFreeTier(event.target.checked); geminiTextSession.freeTierConfirmed = event.target.checked }} className="mt-1" />I confirm this key belongs to a Google AI Studio Free tier project with billing disabled. Google controls the account’s tier; the app cannot verify it. No paid fallback is used.</label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={consent} disabled={busy || applied} onChange={event => { setConsent(event.target.checked); geminiTextSession.consent = event.target.checked }} className="mt-1" />Send only this selected text and my instruction to Google for this preview. Free-tier content may be used to improve Google’s products. These choices reset when the editor restarts.</label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <section><h3 className="mb-2 font-semibold">Original selection</h3><div aria-label="Original selected text" className="max-h-64 min-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-400 bg-slate-50 p-3 leading-relaxed">{showText(segments)}</div></section>
        <section><h3 className="mb-2 font-semibold">Proposed wording</h3><div aria-label="Gemini text preview" aria-live="polite" className="max-h-64 min-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-blue-400 bg-blue-50/40 p-3 leading-relaxed">{suggestion ? showText(suggestion) : busy ? 'Gemini is preparing a suggestion…' : 'Choose Preview to see a suggestion here. Your page stays unchanged.'}</div></section>
      </div>
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {applied && <p role="status" className="rounded border border-green-300 bg-green-50 p-3">Applied to the selected text. Formatting and links are retained. Undo restores the original selection.</p>}
      <p className="text-xs text-slate-600">Review names, dates and other facts before applying. Only this selection can change. Nothing is published.</p>
    </div>
    <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-300 bg-white px-5 py-3">
      {busy ? <button type="button" className="rounded border border-slate-500 px-4 py-2" onClick={() => request.current?.abort()}>Stop</button> : <button type="button" disabled={!consent || !freeTier || !instruction.trim() || applied} className="rounded bg-blue-800 px-4 py-2 font-semibold text-white disabled:opacity-40" onClick={async () => {
        const controller = new AbortController(); request.current = controller; setBusy(true); setError(''); setSuggestion(null)
        try { const result = await suggestSelectedText(segments, instruction, { consent, freeTierConfirmed: freeTier, signal: controller.signal }); if (!controller.signal.aborted) setSuggestion(result) }
        catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The suggestion could not be prepared.') }
        finally { if (request.current === controller) { request.current = null; setBusy(false) } }
      }}>Preview</button>}
      <button type="button" disabled={!suggestion || busy || applied} className="rounded bg-orange-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40" onClick={() => { if (!suggestion) return; try { onApply(suggestion); setApplied(true); setError('') } catch (failure) { setError(failure instanceof Error ? failure.message : 'The selection could not be changed.') } }}>Apply</button>
      <button type="button" disabled={!applied} className="rounded border border-slate-500 px-4 py-2 disabled:opacity-40" onClick={() => { try { onUndo(); dismiss() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Use the editor’s Undo command.') } }}>Undo</button>
      <button type="button" className="rounded border border-slate-500 px-4 py-2" onClick={dismiss}>{applied ? 'Close' : 'Cancel'}</button>
    </footer>
  </dialog>
}
