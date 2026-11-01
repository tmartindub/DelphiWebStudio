import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { BlockConfig } from '../types'

GlobalWorkerOptions.workerSrc = workerUrl

export function PdfBlock({ block }: { block: BlockConfig }) {
  const title = typeof block.props.title === 'string' ? block.props.title : 'PDF document'
  const caption = typeof block.props.caption === 'string' ? block.props.caption : ''
  const accessibilityLabel = typeof block.props.accessibilityLabel === 'string' && block.props.accessibilityLabel.trim() ? block.props.accessibilityLabel : title
  const mobileLink = block.props.mobileMode === 'link'
  const src = typeof block.props.src === 'string' ? block.props.src : ''
  const requestedHeight = Number(block.props.height)
  const height = Number.isFinite(requestedHeight) && requestedHeight >= 200 && requestedHeight <= 2000 ? requestedHeight : 600
  const fitMode = block.props.fitMode === 'width' || block.props.fitMode === 'page' ? block.props.fitMode : 'auto'
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const thumbnailsRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(0)
  const searchRef = useRef(0)
  const [width, setWidth] = useState(0)
  const [documentState, setDocumentState] = useState<{ src: string; pdf?: PDFDocumentProxy; error?: string } | null>(null)
  const [pageState, setPageState] = useState<{ src: string; number: number } | null>(null)
  const [zoomState, setZoomState] = useState<{ src: string; value: number } | null>(null)
  const [queryState, setQueryState] = useState<{ src: string; value: string } | null>(null)
  const [searchState, setSearchState] = useState<{ src: string; message: string } | null>(null)
  const [rendered, setRendered] = useState<{ src: string; number: number; width: number; zoom: number; height: number; fitMode: string } | null>(null)
  const pdf = documentState?.src === src ? documentState.pdf : undefined
  const showThumbnails = block.props.showThumbnails === true
  const error = documentState?.src === src ? documentState.error : undefined
  const requestedPage = Number(block.props.initialPage)
  const initialPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const pageNumber = pageState?.src === src ? pageState.number : Math.min(initialPage, pdf?.numPages ?? initialPage)
  const zoom = zoomState?.src === src ? zoomState.value : 1
  const query = queryState?.src === src ? queryState.value : ''
  const pageRendered = rendered?.src === src && rendered.number === pageNumber && rendered.width === width && rendered.zoom === zoom && rendered.height === height && rendered.fitMode === fitMode

  useEffect(() => {
    const element = areaRef.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      const measured = Math.max(1, element.clientWidth - 16)
      if (measured !== widthRef.current) {
        widthRef.current = measured
        setRendered(null)
        setWidth(measured)
      }
    })
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
      const widthScale = width / original.width
      const pageScale = Math.min(widthScale, Math.max(1, height - 16) / original.height)
      const fitScale = Math.min(4, fitMode === 'page' ? pageScale : fitMode === 'width' ? widthScale : Math.min(1, widthScale))
      const viewport = page.getViewport({ scale: fitScale * zoom })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable.')
      renderTask = page.render({ canvas, canvasContext: context, viewport })
      return renderTask.promise.then(() => { if (active) setRendered({ src, number: pageNumber, width, zoom, height, fitMode }) })
    }).catch(cause => {
      if (active && cause?.name !== 'RenderingCancelledException') setDocumentState({ src, error: `Unable to render PDF: ${cause instanceof Error ? cause.message : String(cause)}` })
    })
    return () => { active = false; renderTask?.cancel() }
  }, [pdf, pageNumber, width, zoom, src, height, fitMode])

  useEffect(() => () => { searchRef.current++ }, [src])

  useEffect(() => {
    const container = thumbnailsRef.current
    if (!pdf || !showThumbnails || !container) return
    let active = true
    const pending = new Set<{ cancel: () => void; promise: Promise<void> }>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLCanvasElement)) continue
        const canvas = entry.target
        observer.unobserve(canvas)
        const number = Number(canvas.dataset.page)
        void pdf.getPage(number).then(page => {
          if (!active) return
          const original = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: Math.min(60 / original.width, 80 / original.height) })
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
          const context = canvas.getContext('2d')
          if (!context) return
          const task = page.render({ canvas, canvasContext: context, viewport })
          pending.add(task)
          return task.promise.finally(() => pending.delete(task))
        }).catch(() => undefined)
      }
    }, { root: container, rootMargin: '100px' })
    container.querySelectorAll('canvas[data-page]').forEach(canvas => observer.observe(canvas))
    return () => { active = false; observer.disconnect(); pending.forEach(task => task.cancel()) }
  }, [pdf, showThumbnails])

  async function search() {
    if (!pdf || !query.trim()) return
    const searchId = ++searchRef.current
    const needle = query.trim().toLocaleLowerCase()
    setSearchState({ src, message: 'Searching…' })
    try {
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index)
        const content = await page.getTextContent()
        if (searchRef.current !== searchId) return
        const text = content.items.map(item => 'str' in item ? item.str : '').join(' ').toLocaleLowerCase()
        if (text.includes(needle)) {
          if (index !== pageNumber) { setRendered(null); setPageState({ src, number: index }) }
          setSearchState({ src, message: `Found on page ${index}.` })
          return
        }
      }
      if (searchRef.current === searchId) setSearchState({ src, message: 'No matching text found. Scanned pages may not contain searchable text.' })
    } catch (cause) {
      if (searchRef.current === searchId) setSearchState({ src, message: `Search failed: ${cause instanceof Error ? cause.message : String(cause)}` })
    }
  }

  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {caption && <p className="text-sm mb-3">{caption}</p>}
      {src ? <>
        {mobileLink && <a href={src} className="ws-pdf-mobile-link text-green" download>Open or download PDF</a>}
        <div className={mobileLink ? 'ws-pdf-viewer-when-wide' : undefined}>
        <div className="flex flex-wrap items-center gap-3 mb-2 text-sm">
          <button type="button" disabled={!pdf || pageNumber <= 1} onClick={() => { searchRef.current++; setSearchState(null); setRendered(null); setPageState({ src, number: pageNumber - 1 }) }}>Previous</button>
          <label>Page <input aria-label="PDF page number" type="number" min={1} max={pdf?.numPages ?? 1} value={pageNumber} disabled={!pdf} onChange={event => {
            const value = Number(event.target.value)
            if (pdf && Number.isInteger(value) && value >= 1 && value <= pdf.numPages) { setRendered(null); setPageState({ src, number: value }) }
          }} className="w-14 max-w-full bg-bg-2 border border-border-default rounded px-1" /></label><span>of {pdf?.numPages ?? '…'}</span>
          <button type="button" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => { searchRef.current++; setSearchState(null); setRendered(null); setPageState({ src, number: pageNumber + 1 }) }}>Next</button>
          <button type="button" aria-label="Zoom out" disabled={!pdf || zoom <= 0.5} onClick={() => { setRendered(null); setZoomState({ src, value: Math.max(0.5, zoom - 0.25) }) }}>−</button>
          <span>Fit {Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" disabled={!pdf || zoom >= 3} onClick={() => { setRendered(null); setZoomState({ src, value: Math.min(3, zoom + 0.25) }) }}>+</button>
          {block.props.showSearch !== false && <><input aria-label="Search PDF text" value={query} onChange={event => { searchRef.current++; setSearchState(null); setQueryState({ src, value: event.target.value }) }} onKeyDown={event => { if (event.key === 'Enter') void search() }} className="w-32 max-w-full bg-bg-2 border border-border-default rounded px-2 py-1" />
          <button type="button" onClick={() => void search()} disabled={!pdf || !query.trim()}>Search</button></>}
          {block.props.showDownload !== false && <a href={src} download className="text-green">Open or download PDF</a>}
          {block.props.showPrint !== false && <a href={src} target="_blank" rel="noopener noreferrer" className="text-green">Open PDF to print</a>}
          {block.props.showFullscreen !== false && <button type="button" onClick={() => { void areaRef.current?.requestFullscreen().catch(() => undefined) }}>Fullscreen</button>}
        </div>
        {error && <p role="status" className="text-sm">{error}</p>}
        {!pdf && !error && <p role="status" className="text-sm">Loading PDF…</p>}
        {pdf && !pageRendered && <p role="status" className="text-sm">Rendering page…</p>}
        {searchState?.src === src && <p role="status" className="text-sm">{searchState.message}</p>}
        {pdf && showThumbnails && <div ref={thumbnailsRef} aria-label="PDF page thumbnails" className="flex gap-2 overflow-x-auto mb-2">
          {Array.from({ length: pdf.numPages }, (_, index) => <button key={index} type="button" aria-label={`Go to PDF page ${index + 1}`} aria-current={pageNumber === index + 1 ? 'page' : undefined} onClick={() => { setRendered(null); setPageState({ src, number: index + 1 }) }} className="shrink-0 border border-border-default rounded p-1 text-xs">
            <canvas data-page={index + 1} width={1} height={1} aria-hidden="true" className="block bg-white mx-auto" />{index + 1}
          </button>)}
        </div>}
        <div ref={areaRef} style={{ height }} className="overflow-auto bg-bg-2 p-2">
          <canvas key={`${src}:${pageNumber}:${width}:${zoom}:${height}:${fitMode}`} ref={canvasRef} aria-label={`Page ${pageNumber} of ${accessibilityLabel}`} data-rendered={pageRendered ? 'true' : undefined} className="mx-auto bg-white" />
        </div>
        </div>
      </> : <p>Select a PDF from the media library.</p>}
    </section>
  )
}
