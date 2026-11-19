import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { BlockConfig } from '../types'

GlobalWorkerOptions.workerSrc = workerUrl

export function PdfBlock({ block }: { block: BlockConfig }) {
  const title = typeof block.props.title === 'string' ? block.props.title : 'PDF document'
  const src = typeof block.props.src === 'string' ? block.props.src : ''
  const requestedHeight = Number(block.props.height)
  const height = Number.isFinite(requestedHeight) && requestedHeight >= 200 && requestedHeight <= 2000 ? requestedHeight : 600
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [documentState, setDocumentState] = useState<{ src: string; pdf?: PDFDocumentProxy; error?: string } | null>(null)
  const [pageState, setPageState] = useState<{ src: string; number: number } | null>(null)
  const [rendered, setRendered] = useState<{ src: string; number: number; width: number } | null>(null)
  const pdf = documentState?.src === src ? documentState.pdf : undefined
  const error = documentState?.src === src ? documentState.error : undefined
  const pageNumber = pageState?.src === src ? pageState.number : 1
  const pageRendered = rendered?.src === src && rendered.number === pageNumber && rendered.width === width

  useEffect(() => {
    const element = areaRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setWidth(Math.max(1, element.clientWidth - 16)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [src])

  useEffect(() => {
    if (!src) return
    let active = true
    let cancelled = false
    const task = getDocument({ url: src, enableXfa: false })
    task.onPassword = (update: (password: string) => void) => {
      const password = window.prompt('Enter the PDF password:')
      if (password === null) {
        cancelled = true
        if (active) setDocumentState({ src, error: 'Password required.' })
        void task.destroy().catch(() => undefined)
      } else update(password)
    }
    task.promise.then(document => { if (active) setDocumentState({ src, pdf: document }) }).catch(cause => {
      if (active && !cancelled) setDocumentState({ src, error: `Unable to open PDF: ${cause instanceof Error ? cause.message : String(cause)}` })
    })
    return () => { active = false; void task.destroy().catch(() => undefined) }
  }, [src])

  useEffect(() => {
    if (!pdf || !canvasRef.current || !width) return
    let active = true
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined
    pdf.getPage(pageNumber).then(page => {
      const canvas = canvasRef.current
      if (!active || !canvas) return
      const original = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(1, width / original.width) })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable.')
      renderTask = page.render({ canvas, canvasContext: context, viewport })
      return renderTask.promise.then(() => { if (active) setRendered({ src, number: pageNumber, width }) })
    }).catch(cause => {
      if (active && cause?.name !== 'RenderingCancelledException') setDocumentState({ src, error: `Unable to render PDF: ${cause instanceof Error ? cause.message : String(cause)}` })
    })
    return () => { active = false; renderTask?.cancel() }
  }, [pdf, pageNumber, width, src])

  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {src ? <>
        <div className="flex flex-wrap items-center gap-3 mb-2 text-sm">
          <button type="button" disabled={!pdf || pageNumber <= 1} onClick={() => setPageState({ src, number: pageNumber - 1 })}>Previous</button>
          <span>Page {pageNumber} of {pdf?.numPages ?? '…'}</span>
          <button type="button" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageState({ src, number: pageNumber + 1 })}>Next</button>
          <a href={src} download className="text-green">Open or download PDF</a>
        </div>
        {error && <p role="status" className="text-sm">{error}</p>}
        {!pdf && !error && <p role="status" className="text-sm">Loading PDF…</p>}
        {pdf && !pageRendered && <p role="status" className="text-sm">Rendering page…</p>}
        <div ref={areaRef} style={{ height }} className="overflow-auto bg-bg-2 p-2">
          <canvas ref={canvasRef} aria-label={`Page ${pageNumber} of ${title}`} data-rendered={pageRendered ? 'true' : undefined} className="mx-auto bg-white" />
        </div>
      </> : <p>Select a PDF from the media library.</p>}
    </section>
  )
}
