import type { BlockConfig } from '../types'

export function PdfBlock({ block }: { block: BlockConfig }) {
  const title = typeof block.props.title === 'string' ? block.props.title : 'PDF document'
  const src = typeof block.props.src === 'string' ? block.props.src : ''
  const requestedHeight = Number(block.props.height)
  const height = Number.isFinite(requestedHeight) && requestedHeight >= 200 && requestedHeight <= 2000 ? requestedHeight : 600
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {src ? <object data={src} type="application/pdf" aria-label={title} style={{ width: '100%', height }}>
        <a href={src} download>Open or download PDF</a>
      </object> : <p>Select a PDF from the media library.</p>}
      {src && <a href={src} download className="text-green">Open or download PDF</a>}
    </section>
  )
}
