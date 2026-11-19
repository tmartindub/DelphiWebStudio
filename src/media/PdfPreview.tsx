import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { MediaAsset } from './media-library'

GlobalWorkerOptions.workerSrc = workerUrl

export function PdfPreview({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Loading document…')
  const [downloadUrl, setDownloadUrl] = useState('')

  useEffect(() => {
    let active = true
    let task: ReturnType<typeof getDocument> | undefined
    const url = URL.createObjectURL(asset.content)
    asset.content.arrayBuffer().then(bytes => {
      if (!active) return
      setDownloadUrl(url)
      task = getDocument({ data: new Uint8Array(bytes), enableXfa: false })
      task.onPassword = (update: (password: string) => void) => {
        const password = window.prompt('Enter the PDF password:')
        if (password === null) { void task?.destroy().catch(() => undefined); setStatus('Password required.') }
        else update(password)
      }
      return task.promise.then(document => { if (active) { setPdf(document); setStatus('') } })
    }).catch(error => { if (active) setStatus(`Unable to open PDF: ${error instanceof Error ? error.message : String(error)}`) })
    return () => { active = false; void task?.destroy().catch(() => undefined); URL.revokeObjectURL(url) }
  }, [asset])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let active = true
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined
    pdf.getPage(pageNumber).then(page => {
      const canvas = canvasRef.current
      if (!active || !canvas) return
      const viewport = page.getViewport({ scale: zoom })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable.')
      renderTask = page.render({ canvas, canvasContext: context, viewport })
      return renderTask.promise
    }).catch(error => {
      if (active && error?.name !== 'RenderingCancelledException') setStatus(`Unable to render page: ${error instanceof Error ? error.message : String(error)}`)
    })
    return () => { active = false; renderTask?.cancel() }
  }, [pdf, pageNumber, zoom])

  async function search() {
    if (!pdf || !query.trim()) return
    const needle = query.trim().toLocaleLowerCase()
    setStatus('Searching…')
    try {
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index)
        const content = await page.getTextContent()
        const text = content.items.map(item => 'str' in item ? item.str : '').join(' ').toLocaleLowerCase()
        if (text.includes(needle)) { setPageNumber(index); setStatus(`Found on page ${index}.`); return }
      }
      setStatus('No matching text found. Scanned pages may not contain searchable text.')
    } catch (error) {
      setStatus(`Search failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`PDF preview: ${asset.name}`} className="fixed inset-4 z-[100] bg-bg-1 border border-border-default rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="p-3 flex flex-wrap items-center gap-2 border-b border-border-default text-xs">
        <strong className="mr-auto text-text-0">{asset.name}</strong>
        <button type="button" onClick={() => setPageNumber(number => Math.max(1, number - 1))} disabled={!pdf || pageNumber <= 1}>Previous</button>
        <span>Page {pageNumber} of {pdf?.numPages ?? '…'}</span>
        <button type="button" onClick={() => setPageNumber(number => Math.min(pdf?.numPages ?? 1, number + 1))} disabled={!pdf || pageNumber >= pdf.numPages}>Next</button>
        <button type="button" onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(value => Math.min(3, value + 0.25))}>+</button>
        <input aria-label="Search PDF text" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void search() }} className="bg-bg-2 border border-border-default rounded px-2 py-1" />
        <button type="button" onClick={() => void search()} disabled={!pdf || !query.trim()}>Search</button>
        {downloadUrl && <a href={downloadUrl} download={asset.name}>Download</a>}
        <button type="button" onClick={() => { void panelRef.current?.requestFullscreen().catch(() => setStatus('Fullscreen is unavailable.')) }}>Fullscreen</button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      {status && <div role="status" className="px-3 py-2 text-xs text-text-1">{status}</div>}
      <div className="flex-1 overflow-auto p-4"><canvas ref={canvasRef} aria-label={`Page ${pageNumber} of ${asset.name}`} className="mx-auto max-w-none bg-white" /></div>
    </div>
  )
}
