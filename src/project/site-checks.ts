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
      const links = block.type === 'hero' ? [['primaryCta', 'primaryCtaUrl'], ['secondaryCta', 'secondaryCtaUrl']]
        : block.type === 'cta' ? [['buttonText', 'buttonUrl']]
        : block.type === 'navbar' ? [['ctaText', 'ctaUrl']]
        : block.type === 'banner' ? [['linkText', 'linkUrl']] : []
      for (const [labelKey, urlKey] of links) {
        const label = typeof block.props[labelKey] === 'string' ? (block.props[labelKey] as string).trim() : ''
        const url = typeof block.props[urlKey] === 'string' ? (block.props[urlKey] as string).trim() : ''
        if (label && !url) add(`${label}: no link destination is set.`)
        if (!label && url) add(`${urlKey}: the link has no visible label.`)
        if (!url.startsWith('/') || url.startsWith('//')) continue
        const path = url.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
        const target = pages.find(item => item.path === path || encodeURI(item.path) === path)
        if (!target) add(`${url}: does not match a site page; it may point to a separate file or host resource.`)
        else if (target.webstudioArticle?.status === 'draft') add(`${url}: points to a draft article that is omitted from export.`)
      }
      if (block.type === 'image' && typeof block.props.src === 'string' && block.props.src && !String(block.props.alt ?? '').trim()) {
        add('Image has no alternative text. Add a description or confirm that it is decorative.')
      }
      if (block.type === 'gallery' || block.type === 'image') {
        const images = Array.isArray(block.props.images) ? block.props.images : []
        for (const [index, image] of images.entries()) {
          if (image && typeof image === 'object' && typeof image.src === 'string' && image.src && !String(image.alt ?? '').trim()) add(`Image ${index + 1} has no alternative text. Add a description or confirm that it is decorative.`)
        }
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
