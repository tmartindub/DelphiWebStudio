import type { BlockConfig, SiteConfig } from '../types'

export interface GalleryPhoto extends Record<string, unknown> {
  id: string
  src: string
  alt: string
  caption: string
  assetId?: string
  exportThumbnail?: { src: string; width: number; height: number }
}

/** Upgrade older gallery entries and misplaced photos to one persistent collection. */
export function normalizeGalleryBlock(block: BlockConfig): BlockConfig {
  if (block.type !== 'gallery') return block
  const props = block.props
  const images = (Array.isArray(props.images) ? props.images : []) as Record<string, unknown>[]
  const objects = (Array.isArray(props.section1Objects) ? props.section1Objects : []) as Record<string, unknown>[]
  const placed = (Array.isArray(props.placedMedia) ? props.placedMedia : []) as Record<string, unknown>[]
  const loose = objects.filter(item => item.type === 'image' && !item.parentId && typeof item.src === 'string' && item.src)
  const media = placed.filter(item => typeof item.mime === 'string' && item.mime.startsWith('image/') && typeof item.src === 'string' && item.src)
  const entries: Record<string, unknown>[] = [...images, ...[...loose, ...media].map(item => ({
    ...Object.fromEntries(Object.entries(item).filter(([key]) => !['type', 'parentId', 'x', 'y', 'width', 'height', 'layer', 'name', 'mime'].includes(key))),
    alt: typeof item.alt === 'string' ? item.alt : typeof item.name === 'string' ? item.name : '',
  }))]
  const reserved = new Set(entries.flatMap(item => typeof item.id === 'string' && item.id.trim() ? [item.id] : []))
  const seen = new Set<string>()
  const photos = entries.map((item, index) => {
    let id = typeof item.id === 'string' ? item.id : ''
    if (!id.trim() || seen.has(id)) {
      id = `${block.id}-photo-${index + 1}`
      while (seen.has(id) || reserved.has(id)) id += '-new'
    }
    seen.add(id)
    return { ...item, id, src: typeof item.src === 'string' ? item.src : '', alt: typeof item.alt === 'string' ? item.alt : '', caption: typeof item.caption === 'string' ? item.caption : '' }
  })
  const next = { ...props, images: photos,
    ...(loose.length ? { section1Objects: objects.filter(item => !loose.includes(item)) } : {}),
    ...(media.length ? { placedMedia: placed.filter(item => !media.includes(item)) } : {}),
  }
  return JSON.stringify(next) === JSON.stringify(props) ? block : { ...block, props: next }
}

export function normalizeGalleryConfig(config: SiteConfig): SiteConfig {
  const pages = config.pages?.length ? config.pages.map(page => ({ ...page, blocks: page.blocks.map(normalizeGalleryBlock) })) : undefined
  return { ...config, ...(pages ? { pages } : {}), blocks: pages ? (pages.find(page => page.path === '/') ?? pages[0]).blocks : config.blocks.map(normalizeGalleryBlock),
    ...(config.webstudioReusableSections ? { webstudioReusableSections: config.webstudioReusableSections.map(section => ({ ...section, block: normalizeGalleryBlock(section.block) })) } : {}),
  }
}
