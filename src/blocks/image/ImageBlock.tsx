import { ImageIcon } from 'lucide-react'
import type { BlockConfig } from '../types'

function Placeholder({ className, height }: { className?: string; height?: number }) {
  return (
    <div style={height ? { height } : undefined} className={`bg-gradient-to-br from-bg-3 to-bg-4 flex items-center justify-center ${className || ''}`}>
      <ImageIcon size={32} className="text-text-3" />
    </div>
  )
}

export function ImageBlock({ block, editable = false }: { block: BlockConfig; editable?: boolean }) {
  const { variant, props } = block
  const src = props.src as string | undefined
  const alt = (props.alt as string) || ''
  const pageHeading = typeof props.pageHeading === 'string' ? props.pageHeading.trim() : ''
  const rawTitle = props.title as string | undefined
  // Older inserted media used its filename as a visible title; retain the data but do not overlay it.
  const title = rawTitle && rawTitle === alt && /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(rawTitle) ? undefined : rawTitle
  const subtitle = props.subtitle as string | undefined
  const imageSide = (props.imageSide as string) || 'left'
  const images = (props.images as { src?: string; alt?: string }[]) || []
  const requestedHeight = Number(props.layoutHeight)
  const imageHeight = Number.isFinite(requestedHeight) && requestedHeight > 0
    ? Math.max(40, Math.min(2000, requestedHeight)) : undefined
  const imageFit = props.imageFit === 'contain' || props.imageFit === 'fill' ? props.imageFit : 'cover'
  const imageLink = typeof props.imageLink === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(props.imageLink) ? props.imageLink : ''

  if (variant === 'side-by-side') {
    const imgEl = src
      ? <img src={src} alt={alt} style={{ ...(imageHeight ? { height: imageHeight } : {}), objectFit: imageFit }} className="w-full h-full object-cover rounded-lg" />
      : <Placeholder height={imageHeight} className="w-full h-64 @lg:h-80 rounded-lg" />

    return (
      <div className="px-6 py-12 @lg:px-16 @lg:py-16">
        {pageHeading && <h1 className="sr-only">{pageHeading}</h1>}
        <div className={`grid grid-cols-1 @lg:grid-cols-2 gap-8 @lg:gap-12 items-center ${imageSide === 'right' ? '' : ''}`}>
          <div className={`reveal-scale reveal-d1 ${imageSide === 'right' ? '@lg:order-2' : ''}`}>
            {src && imageLink ? <a href={imageLink} onClick={editable ? event => event.preventDefault() : undefined}>{imgEl}</a> : imgEl}
          </div>
          <div className={`reveal-fade-up reveal-d2 ${imageSide === 'right' ? '@lg:order-1' : ''}`}>
            {title && <h2 className="text-2xl font-display font-semibold mb-3">{title}</h2>}
            {subtitle && <p className="text-text-1 leading-relaxed">{subtitle}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'grid') {
    const gridImages = images.length > 0
      ? images.slice(0, 4)
      : [{ src: undefined, alt: '1' }, { src: undefined, alt: '2' }, { src: undefined, alt: '3' }, { src: undefined, alt: '4' }]

    return (
      <div className="px-6 py-12 @lg:px-16 @lg:py-16">
        {pageHeading && <h1 className="sr-only">{pageHeading}</h1>}
        {title && <h2 className="reveal-fade-up reveal-d1 text-2xl font-display font-semibold mb-6 text-center">{title}</h2>}
        <div className="grid grid-cols-2 @lg:grid-cols-4 gap-3">
          {gridImages.map((img, i) => (
            <div key={i} style={imageHeight ? { height: imageHeight, aspectRatio: 'auto' } : undefined} className={`reveal-scale reveal-d${Math.min(i + 2, 8)} aspect-square rounded-lg overflow-hidden`}>
              {img.src
                ? <img src={img.src} alt={img.alt || ''} style={{ objectFit: imageFit }} className="w-full h-full object-cover" />
                : <Placeholder className="w-full h-full" />
              }
            </div>
          ))}
        </div>
      </div>
    )
  }

  // hero-image (default)
  return (
    <div className="reveal-scale reveal-d1 relative">
      {pageHeading && <h1 className="sr-only">{pageHeading}</h1>}
      {src
        ? imageLink ? <a href={imageLink} onClick={editable ? event => event.preventDefault() : undefined}><img src={src} alt={alt} draggable={false} style={{ ...(imageHeight ? { height: imageHeight, objectFit: props.imageFit === 'cover' || props.imageFit === 'fill' ? props.imageFit : 'contain' } : {}) }} className="w-full h-auto" /></a> : <img src={src} alt={alt} draggable={false} style={{ ...(imageHeight ? { height: imageHeight, objectFit: props.imageFit === 'cover' || props.imageFit === 'fill' ? props.imageFit : 'contain' } : {}) }} className="w-full h-auto" />
        : <Placeholder height={imageHeight} className="w-full h-64 @lg:h-96" />
      }
      {(title || subtitle) && (
        <div className="absolute inset-0 bg-gradient-to-t from-bg-0/80 to-transparent flex flex-col justify-end p-6 @lg:p-12">
          {title && <h2 className="reveal-fade-up reveal-d2 text-2xl @lg:text-3xl font-display font-bold mb-2">{title}</h2>}
          {subtitle && <p className="reveal-fade-up reveal-d3 text-text-1 text-sm @lg:text-base max-w-lg">{subtitle}</p>}
        </div>
      )}
    </div>
  )
}
