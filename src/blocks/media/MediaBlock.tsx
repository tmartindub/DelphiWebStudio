import type { BlockConfig } from '../types'

export function MediaBlock({ block }: { block: BlockConfig }) {
  const title = typeof block.props.title === 'string' ? block.props.title : 'Media'
  const src = typeof block.props.src === 'string' ? block.props.src : ''
  return <section className="p-6">
    <h2 className="text-xl font-semibold mb-3">{title}</h2>
    {block.type === 'audio' ? <audio controls src={src} aria-label={title} />
      : block.type === 'mediaVideo' ? <video controls src={src} aria-label={title} className="w-full max-w-3xl" />
        : <a href={src} download className="text-green">Download {title}</a>}
  </section>
}
