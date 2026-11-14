import { ImageIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { BlockConfig } from '../types'
import { connectGalleryViewer } from './gallery-viewer.js'

interface GalleryImage {
  src?: string
  alt?: string
  caption?: string
  exportThumbnail?: { src: string; width: number; height: number }
}

const defaultImages: GalleryImage[] = [
  { alt: 'Image 1' }, { alt: 'Image 2' }, { alt: 'Image 3' },
  { alt: 'Image 4' }, { alt: 'Image 5' }, { alt: 'Image 6' },
]

function ImageCard({ image, tall, responsive, viewer }: { image: GalleryImage; tall?: boolean; responsive: boolean; viewer: boolean }) {
  const canEnlarge = viewer && !!image.src
  const thumbnail = image.exportThumbnail
  return (
    <div className={`relative rounded-lg overflow-hidden border border-border-default group ${tall ? 'row-span-2' : ''}`}>
      {image.src ? (
        <img src={thumbnail?.src || image.src} alt={image.alt || ''}
          className={`${responsive ? 'block h-auto w-auto max-h-[clamp(150px,26cqw,220px)] max-w-full object-contain' : 'w-full h-full object-cover'}${canEnlarge ? ' cursor-zoom-in touch-manipulation focus-visible:outline-2 focus-visible:-outline-offset-2' : ''}`}
          width={thumbnail?.width}
          height={thumbnail?.height}
          style={responsive && thumbnail ? { width: `calc(clamp(150px,26cqw,220px) * ${thumbnail.width / thumbnail.height})`, aspectRatio: `${thumbnail.width} / ${thumbnail.height}` } : undefined}
          loading={thumbnail ? 'lazy' : undefined}
          decoding={responsive || thumbnail ? 'async' : undefined}
          draggable={responsive || canEnlarge ? false : undefined}
          role={canEnlarge ? 'button' : undefined}
          tabIndex={canEnlarge ? 0 : undefined}
          aria-haspopup={canEnlarge ? 'dialog' : undefined}
          aria-label={canEnlarge ? (image.alt ? `Enlarge ${image.alt}` : 'Enlarge photo') : undefined}
          data-ws-gallery-thumbnail={canEnlarge ? true : undefined}
          data-ws-gallery-original={canEnlarge && thumbnail ? image.src : undefined}
          data-ws-gallery-caption={canEnlarge ? image.caption : undefined}
        />
      ) : (
        <div className={`${responsive ? 'w-40 max-w-full' : 'w-full'} h-full min-h-[140px] bg-gradient-to-br from-bg-3 to-bg-4 flex items-center justify-center`}>
          <ImageIcon size={24} className="text-text-3" />
        </div>
      )}
      {image.caption && !canEnlarge && (
        <div className={`${responsive ? 'w-0 min-w-full [overflow-wrap:anywhere] ' : ''}px-3 py-2 bg-bg-2 text-[11px] text-text-2`}>{image.caption}</div>
      )}
    </div>
  )
}

export function GalleryBlock({ block, editable = false }: { block: BlockConfig; editable?: boolean }) {
  const { variant, props } = block
  const title = props.title as string | undefined
  const viewer = props.enablePhotoViewer === true
  const gallery = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (viewer && gallery.current) return connectGalleryViewer(gallery.current)
  }, [viewer])
  const images = ((props.images as GalleryImage[]) || []).length > 0
    ? (props.images as GalleryImage[])
    : defaultImages

  const masonry = variant === 'masonry'
  const responsive = variant === 'responsive'
  return (
    <div ref={gallery} data-ws-gallery-viewer={viewer ? true : undefined} className="px-6 py-12 @lg:px-16 @lg:py-16">
      {title && <h2 className="reveal-fade-up reveal-d1 text-2xl font-display font-semibold mb-6 text-center">{title}</h2>}
      <div className={responsive ? 'flex flex-wrap items-start gap-3' : `grid grid-cols-2 @lg:grid-cols-3 gap-3${masonry ? ' auto-rows-[160px]' : ''}`}>
        {images.map((img, i) => (
          <div key={i} data-ws-item-field="images" data-ws-item-index={i}
            className={`relative ${responsive ? 'min-w-0 max-w-full [&[draggable=true]]:cursor-grab [&[draggable=true]:active]:cursor-grabbing' : `reveal-scale reveal-d${Math.min(i + 2, 8)}`}`}>
            <ImageCard image={img} responsive={responsive} tall={masonry && i % 3 === 0} viewer={viewer} />
            {editable && <span data-gallery-position={i + 1} aria-label={`Photo position ${i + 1}`} className="pointer-events-none absolute left-1.5 top-1.5 z-10 rounded border border-slate-400 bg-white/95 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-800 shadow-sm">{i + 1}</span>}
          </div>
        ))}
      </div>
      {viewer && <dialog data-ws-gallery-dialog aria-label="Enlarged photo"
        className="@container m-auto max-h-[92dvh] w-[min(94vw,94cqw,72rem)] max-w-none overflow-auto rounded-xl border border-slate-300 bg-white text-slate-900 shadow-2xl backdrop:bg-slate-950/75 [color-scheme:light]">
        <form method="dialog" className="sticky top-0 z-10 flex justify-end border-b border-slate-200 bg-white px-3 py-2">
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100">Close photo</button>
        </form>
        <figure className="grid gap-4 p-3 @min-[40rem]:data-[caption=true]:grid-cols-[minmax(0,1fr)_minmax(12rem,27%)] @min-[40rem]:p-4">
          <div className="flex min-w-0 items-center justify-center rounded-md bg-slate-100">
            <img data-ws-gallery-expanded alt="" className="block h-auto max-h-[70dvh] w-auto max-w-full object-contain" />
          </div>
          <figcaption hidden className="self-center whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-base leading-relaxed [overflow-wrap:anywhere]" />
        </figure>
      </dialog>}
    </div>
  )
}
