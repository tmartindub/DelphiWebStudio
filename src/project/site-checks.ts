import type { SiteConfig } from '@/blocks/types'
import { validateProjectConfig } from './project-file'
import { buttonLinks, pageLinkPath, visitBlockLinks } from './page-links'
import { exportSiteToHTML } from '@/lib/export-html'

export interface SiteIssue {
  pageId: string
  pageName: string
  blockId: string
  message: string
}

/** Local, limited checks. External URLs and arbitrary extension content are not inspected. */
export function checkSite(config: SiteConfig, settings?: { seoTitle?: string; seoDescription?: string; siteName?: string; siteDescription?: string; webmasterEmail?: string; siteSearch?: string }, checkHeadings = false): SiteIssue[] {
  const pages = validateProjectConfig(config).pages!
  const generatedPaths = new Set<string>([...(settings?.siteSearch === 'on' ? ['/search.html'] : []), ...(pages.some(page => page.webstudioArticle?.status === 'ready') ? ['/articles/index.html'] : [])])
  const issues: SiteIssue[] = []
  if (settings) {
    const publishedPages = pages.filter(page => page.webstudioArticle?.status !== 'draft')
    const titles = publishedPages.map(page => (page.webstudioSeo?.title?.trim() || settings.seoTitle || settings.siteName || page.name || 'Website').trim())
    for (const [index, page] of publishedPages.entries()) {
      const title = titles[index]
      const description = (page.webstudioSeo?.description?.trim() || settings.seoDescription || settings.siteDescription || '').trim()
      if (!title) issues.push({ pageId: page.id, pageName: page.name, blockId: '', message: 'Page has no SEO title. Add one in page settings.' })
      else if (titles.filter(value => value.toLocaleLowerCase() === title.toLocaleLowerCase()).length > 1) issues.push({ pageId: page.id, pageName: page.name, blockId: '', message: 'Another page uses the same SEO title. Give pages distinct titles in page settings.' })
      if (!description) issues.push({ pageId: page.id, pageName: page.name, blockId: '', message: 'Page has no meta description. Add one in page settings or site settings.' })
    }
  }
  const pageAnchors = new Map(pages.map(page => {
    const anchors = new Set<string>()
    for (const block of page.blocks) {
      const count = Math.min(4, Math.max(1, Math.floor(Number(block.props.sectionCount) || 1)))
      const names = [block.props.anchorName]
      for (let section = 1; section <= count; section++) {
        const items = block.props['section' + section + 'Objects']
        if (Array.isArray(items)) for (const item of items) names.push(item?.anchorName)
      }
      for (const name of names) {
        if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) continue
        if (name === 'main-content' || anchors.has(name)) issues.push({ pageId: page.id, pageName: page.name, blockId: block.id, message: 'Duplicate anchor #' + name + '. Give each destination a unique name.' })
        anchors.add(name)
      }
    }
    return [page.id, anchors] as const
  }))
  for (const page of pages) {
    if (checkHeadings && page.blocks.length && page.webstudioArticle?.status !== 'draft') {
      try {
        const html = exportSiteToHTML({ name: page.name, blocks: page.blocks, theme: config.theme }, { settings })
        const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? ''
        const headings = [...main.matchAll(/<h([1-6])(?:\s[^>]*)?>/gi)].map(match => Number(match[1]))
        const report = (message: string) => issues.push({ pageId: page.id, pageName: page.name, blockId: '', message })
        const mainHeadings = headings.filter(level => level === 1).length
        if (!mainHeadings) report('No H1 heading was found in the generated page. Use a main heading to introduce the page.')
        if (mainHeadings > 1) report('The generated page contains more than one H1 heading. Review its heading structure.')
        const gap = headings.findIndex((level, index) => index > 0 && level > headings[index - 1] + 1)
        if (gap >= 0) report(`Heading order skips from H${headings[gap - 1]} to H${headings[gap]}. Review the heading levels.`)
      } catch { /* Other checks still run for pages with export errors. */ }
    }
    for (const block of page.blocks) {
      const add = (message: string) => issues.push({ pageId: page.id, pageName: page.name, blockId: block.id, message })
      if (settings) {
        const directMedia = [block.props.heroImage, block.props.logoImage]
        if (['image', 'audio', 'mediaVideo', 'document'].includes(block.type)) directMedia.push(block.props.src)
        for (const collection of [block.props.images, block.props.items, block.props.members, block.props.logos]) {
          if (!Array.isArray(collection)) continue
          for (const item of collection) {
            if (item && typeof item === 'object') directMedia.push(item.src, item.image, item.avatar)
          }
        }
        const hostedVideo = block.type === 'video' && typeof block.props.url === 'string' && /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(block.props.url)
        if (hostedVideo || directMedia.some(value => typeof value === 'string' && /^(?:https?:)?\/\//i.test(value.trim()))) {
          add('This block uses online media. Import the file into Media for offline use; hosted videos require internet access.')
        }
      }
      if (block.type === 'navbar' || block.type === 'footer') {
        const links = Array.isArray(block.props.links) ? block.props.links : []
        // Footer column entries can be ordinary address, contact or opening-hours text.
        if (links.some(link => typeof link === 'string' && link.trim())) add('This block contains text-only navigation labels that do not link to pages. Add working links under Navigation destinations.')
      }
      if ((block.type === 'navbar' || block.type === 'footer') && Array.isArray(block.props.navItems)) {
        const destinations = block.props.navItems.flatMap(item => [item, ...(block.type === 'navbar' && Array.isArray(item?.children) ? item.children : [])])
        for (const item of destinations) {
          if (!item || typeof item !== 'object') { add('A navigation destination is invalid.'); continue }
          const label = typeof item.label === 'string' ? item.label.trim() : ''
          const url = typeof item.url === 'string' ? item.url.trim() : ''
          if (!label || !url) { add('A navigation destination needs both a label and a URL.'); continue }
        }
      }
      for (const [labelKey, urlKey] of buttonLinks[block.type] ?? []) {
        const label = typeof block.props[labelKey] === 'string' ? String(block.props[labelKey]).trim() : ''
        const url = typeof block.props[urlKey] === 'string' ? String(block.props[urlKey]).trim() : ''
        if (label && !url) add(label + ': no link destination is set.')
        if (!label && url) add(urlKey + ': the link has no visible label.')
      }
      visitBlockLinks(block, (url, label) => {
        if (/[\\\p{Cc}]/u.test(url) || url.startsWith('//') || (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|mailto:|tel:)/i.test(url))) {
          add(label + ': unsupported link address; it will be shown as text in the export.')
          return
        }
        let target = page
        if (url.startsWith('/')) {
          const path = pageLinkPath(url)
          const destination = pages.find(item => item.path === path || encodeURI(item.path) === path)
          if (!destination) {
            if (!generatedPaths.has(path)) add(url + ': does not match a site page; it may point to a separate file or host resource.')
            return
          }
          target = destination
        } else if (!url.startsWith('#') && !url.startsWith('?')) return
        if (target.webstudioArticle?.status === 'draft') {
          add(url + ': points to a draft article that is omitted from export.')
          return
        }
        const hash = url.indexOf('#')
        if (hash < 0 || target.webstudioCustomCode?.html) return
        let anchor = url.slice(hash + 1).split(':~:', 1)[0]
        try { anchor = decodeURIComponent(anchor) } catch { /* report the literal anchor */ }
        if (anchor && !/^top$/i.test(anchor) && anchor !== 'main-content' && !pageAnchors.get(target.id)?.has(anchor)) {
          add(url + ': anchor #' + anchor + ' was not found on ' + target.name + '.')
        }
      })
      if (block.type === 'image' && block.variant !== 'grid' && !(typeof block.props.src === 'string' && block.props.src.trim())) add('Image has no source and will show a placeholder. Choose an image from Media or enter an image URL.')
      if (block.type === 'image' && block.variant !== 'grid' && typeof block.props.src === 'string' && block.props.src && !String(block.props.alt ?? '').trim()) {
        add('Image has no alternative text. Add a description or confirm that it is decorative.')
      }
      const sectionCount = Math.min(4, Math.max(1, Math.floor(Number(block.props.sectionCount) || 1)))
      for (let section = 1; section <= sectionCount; section++) {
        const items = block.props[`section${section}Objects`]
        if (Array.isArray(items)) for (const [index, item] of items.entries()) {
          if ((item?.type === 'image' || item?.type === 'panel') && typeof item.src === 'string' && item.src && !String(item.alt ?? '').trim()) {
            add(`Section ${section}, item ${index + 1} has an image without alternative text. Add an image description if it conveys information.`)
          }
        }
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
        const email = (typeof block.props.recipientEmail === 'string' && block.props.recipientEmail.trim()) || settings?.webmasterEmail?.trim() || ''
        const endpoint = typeof block.props.formEndpoint === 'string' ? block.props.formEndpoint.trim() : ''
        let validEndpoint = false
        try { const url = new URL(endpoint); validEndpoint = !/[\s\p{Cc}]/u.test(endpoint) && url.protocol === 'https:' && !url.username && !url.password && !url.hash } catch { /* no valid endpoint */ }
        if (endpoint ? !validEndpoint : !/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(email)) add('Contact form has no valid contact email or HTTPS form service URL and will be disabled in the export.')
        if (endpoint && validEndpoint && (typeof block.props.consentNotice !== 'string' || !block.props.consentNotice.trim())) add('Contact form sends visitor information to a service without a privacy and consent notice. Add one in Properties.')
      }
      if (block.type === 'newsletter') add('Newsletter signup has no configured service and will be disabled in the export.')
    }
  }
  return issues
}
