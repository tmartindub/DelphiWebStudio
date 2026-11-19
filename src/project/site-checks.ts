import type { SiteConfig } from '@/blocks/types'
import { validateProjectConfig } from './project-file'

export interface SiteIssue {
  pageId: string
  pageName: string
  blockId: string
  message: string
}

/** Local, limited checks. External URLs and arbitrary extension content are not inspected. */
export function checkSite(config: SiteConfig): SiteIssue[] {
  const pages = validateProjectConfig(config).pages!
  const issues: SiteIssue[] = []
  for (const page of pages) {
    for (const block of page.blocks) {
      const add = (message: string) => issues.push({ pageId: page.id, pageName: page.name, blockId: block.id, message })
      if (block.type === 'navbar' || block.type === 'footer') {
        const links = Array.isArray(block.props.links) ? block.props.links : []
        const columns = block.type === 'footer' && block.variant === 'multi-column' && Array.isArray(block.props.columns) ? block.props.columns : []
        const hasColumnLinks = columns.some(column => column && typeof column === 'object' && Array.isArray(column.links) && column.links.some((link: unknown) => typeof link === 'string' && link.trim()))
        if (links.some(link => typeof link === 'string' && link.trim()) || hasColumnLinks) add('This block contains text-only navigation labels that do not link to pages. Use the site page navigation for working links.')
      }
      if (block.type === 'navbar' && Array.isArray(block.props.navItems)) {
        for (const item of block.props.navItems) {
          if (!item || typeof item !== 'object') { add('A navigation destination is invalid.'); continue }
          const label = typeof item.label === 'string' ? item.label.trim() : ''
          const url = typeof item.url === 'string' ? item.url.trim() : ''
          if (!label || !url) { add('A navigation destination needs both a label and a URL.'); continue }
          if (/[\\\p{Cc}]/u.test(url) || url.startsWith('//') || (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|mailto:|tel:)/i.test(url))) { add(`${label}: unsupported link address; it will be shown as text in the export.`); continue }
          if (url.startsWith('/')) {
            const path = url.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
            const target = pages.find(page => page.path === path || encodeURI(page.path) === path)
            if (!target) add(`${url}: does not match a site page; it may point to a separate file or host resource.`)
            else if (target.webstudioArticle?.status === 'draft') add(`${url}: points to a draft article that is omitted from export.`)
          }
        }
      }
      const links = block.type === 'hero' ? [['primaryCta', 'primaryCtaUrl'], ['secondaryCta', 'secondaryCtaUrl']]
        : block.type === 'cta' ? [['buttonText', 'buttonUrl']]
        : block.type === 'navbar' ? [['ctaText', 'ctaUrl']]
        : block.type === 'banner' ? [['linkText', 'linkUrl']] : []
      for (const [labelKey, urlKey] of links) {
        const label = typeof block.props[labelKey] === 'string' ? (block.props[labelKey] as string).trim() : ''
        const url = typeof block.props[urlKey] === 'string' ? (block.props[urlKey] as string).trim() : ''
        if (label && !url) add(`${label}: no link destination is set.`)
        if (!label && url) add(`${urlKey}: the link has no visible label.`)
        if (url && (/[\\\p{Cc}]/u.test(url) || url.startsWith('//') || (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|mailto:|tel:)/i.test(url)))) {
          add(`${label || urlKey}: unsupported link address; it will be shown as text in the export.`)
          continue
        }
        if (!url.startsWith('/') || url.startsWith('//')) continue
        const path = url.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
        const target = pages.find(item => item.path === path || encodeURI(item.path) === path)
        if (!target) add(`${url}: does not match a site page; it may point to a separate file or host resource.`)
        else if (target.webstudioArticle?.status === 'draft') add(`${url}: points to a draft article that is omitted from export.`)
      }
      if (block.type === 'content' && typeof block.props.body === 'string') {
        for (const match of block.props.body.matchAll(/\[([^\]\n]+)\]\(([^)\s]+)\)/g)) {
          const url = match[2]
          if (/[\\\p{Cc}]/u.test(url) || url.startsWith('//') || (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|mailto:|tel:)/i.test(url))) {
            add(`${match[1]}: unsupported link address; it will be shown as text.`)
          } else if (url.startsWith('/')) {
            const path = url.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
            const target = pages.find(item => item.path === path || encodeURI(item.path) === path)
            if (!target) add(`${url}: does not match a site page; it may point to a separate file or host resource.`)
            else if (target.webstudioArticle?.status === 'draft') add(`${url}: points to a draft article that is omitted from export.`)
          }
        }
      }
      if (block.type === 'image' && block.variant !== 'grid' && !(typeof block.props.src === 'string' && block.props.src.trim())) add('Image has no source and will show a placeholder. Choose an image from Media or enter an image URL.')
      if (block.type === 'image' && block.variant !== 'grid' && typeof block.props.src === 'string' && block.props.src && !String(block.props.alt ?? '').trim()) {
        add('Image has no alternative text. Add a description or confirm that it is decorative.')
      }
      if (block.type === 'gallery' || (block.type === 'image' && block.variant === 'grid')) {
        const images = Array.isArray(block.props.images) ? block.props.images : []
        if (!images.length) add('This image collection has no images and will show placeholders. Add images in Properties.')
        for (const [index, image] of images.entries()) {
          if (!image || typeof image !== 'object' || typeof image.src !== 'string' || !image.src.trim()) add(`Image ${index + 1} has no source and will show a placeholder.`)
          if (image && typeof image === 'object' && typeof image.src === 'string' && image.src && !String(image.alt ?? '').trim()) add(`Image ${index + 1} has no alternative text. Add a description or confirm that it is decorative.`)
        }
      }
      if (['pdfViewer', 'document', 'audio', 'mediaVideo'].includes(block.type) && !(typeof block.props.src === 'string' && block.props.src.trim())) add('This media block has no file selected. Add a file from Media.')
      if (block.type === 'video') {
        const url = typeof block.props.url === 'string' ? block.props.url : ''
        const valid = block.variant === 'vimeo' ? /^(?:https?:\/\/)?(?:(?:www\.)?vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)(?=[/?#]|$)/i.test(url.trim()) : /^(?:https?:\/\/)?(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#]*&)?v=|(?:embed|v|shorts|live)\/)|(?:www\.)?youtu\.be\/)([a-zA-Z0-9_-]{11})(?=[?&#/]|$)/i.test(url.trim())
        if (!valid) add(`Video has no supported ${block.variant === 'vimeo' ? 'Vimeo' : 'YouTube'} address and will show a placeholder.`)
      }
      if (['features', 'testimonials', 'stats', 'faq', 'team', 'logocloud'].includes(block.type)) {
        const key = block.type === 'team' ? 'members' : block.type === 'logocloud' ? 'logos' : 'items'
        const value = block.props[key]
        if (Array.isArray(value) && value.length === 0) add('This block has no entries yet. Add your own content in Properties or remove the block.')
      }
      if (block.type === 'contact') {
        const email = typeof block.props.recipientEmail === 'string' ? block.props.recipientEmail.trim() : ''
        if (!/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(email)) add('Contact form has no valid contact email and will be disabled in the export.')
      }
      if (block.type === 'newsletter') add('Newsletter signup has no configured service and will be disabled in the export.')
    }
  }
  return issues
}
