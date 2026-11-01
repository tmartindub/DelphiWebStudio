import type { PageConfig, SiteConfig } from '@/blocks/types'
import { createProjectFile, type SiteProjectFile } from './project-file'

/** Convert WordPress WXR content to editable text while retaining the original export as inert project data. */
export function importWordPressXml(source: string): { project: SiteProjectFile; pages: number; posts: number; skipped: number; issueCount: number; issues: { source: string; reference: string; reason: string }[] } {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source)) throw new Error('WordPress XML with a document type or entity declaration is not supported.')
  const document = new DOMParser().parseFromString(source, 'application/xml')
  if (document.getElementsByTagName('parsererror').length || document.documentElement.localName !== 'rss') throw new Error('The selected file is not valid WordPress XML.')
  const channel = Array.from(document.documentElement.children).find(element => element.localName === 'channel')
  if (!channel || !Array.from(channel.children).some(element => element.localName === 'wxr_version' && element.namespaceURI?.startsWith('http://wordpress.org/export/'))) throw new Error('The file is not a WordPress WXR export.')
  const items = Array.from(channel.children).filter(element => element.localName === 'item')
  if (items.length > 500) throw new Error('This export has more than 500 items. Split it into smaller WordPress exports.')
  const title = Array.from(channel.children).find(element => element.localName === 'title')?.textContent?.trim() || 'Imported WordPress site'
  const siteUrl = Array.from(channel.children).find(element => element.localName === 'link')?.textContent?.trim() || ''
  const home: PageConfig = { id: `page-${crypto.randomUUID()}`, name: 'Home', path: '/', blocks: [] }
  const pages: PageConfig[] = [home]
  let postCount = 0, pageCount = 0, skipped = 0
  let issueCount = 0
  const issues: { source: string; reference: string; reason: string }[] = []
  function report(sourceName: string, reference: string, reason: string) {
    issueCount++
    if (issues.length < 100) issues.push({ source: sourceName.slice(0, 200), reference: reference.slice(0, 200), reason })
  }
  const entries: { item: Element; kind: 'post' | 'page'; path: string; link: string }[] = []
  for (const item of items) {
    const value = (name: string, namespace?: string) => Array.from(item.children).find(element => element.localName === name && (!namespace || element.namespaceURI?.startsWith(namespace)))?.textContent ?? ''
    const kind = value('post_type', 'http://wordpress.org/export/')
    if (kind !== 'post' && kind !== 'page') {
      skipped++
      report(value('title').trim() || 'Untitled item', value('link').trim(), `Item type not converted: ${kind || 'unknown'}`)
      continue
    }
    if (kind === 'post') postCount++; else pageCount++
    entries.push({ item, kind, path: `/imported-${kind}-${kind === 'post' ? postCount : pageCount}`, link: value('link').trim() })
  }
  if (!postCount && !pageCount) throw new Error('No WordPress posts or pages were found. The original file was not changed.')
  const links = new Map<string, string>()
  const ambiguousLinks = new Set<string>()
  let siteOrigin = ''
  try { const url = new URL(siteUrl); if (/^https?:$/.test(url.protocol)) siteOrigin = url.origin } catch { /* An export without a valid site URL can still be imported. */ }
  for (const entry of entries) {
    if (!entry.link) continue
    try {
      const url = new URL(entry.link, siteUrl)
      if (siteOrigin && url.origin === siteOrigin && !url.username && !url.password) {
        const key = `${url.origin}${url.pathname}${url.search}`
        if (links.has(key)) { links.delete(key); ambiguousLinks.add(key) }
        else if (!ambiguousLinks.has(key)) links.set(key, entry.path)
      }
    } catch { /* The original XML remains available for review. */ }
  }
  for (const { item, kind, path, link } of entries) {
    const value = (name: string, namespace?: string) => Array.from(item.children).find(element => element.localName === name && (!namespace || element.namespaceURI?.startsWith(namespace)))?.textContent ?? ''
    const name = value('title').trim() || `Imported ${kind} ${path.split('-').pop()}`
    const html = value('encoded', 'http://purl.org/rss/1.0/modules/content/')
    const uncommented = html.replace(/<!--[\s\S]*?-->/g, '')
    if (/<(?:script|style)\b/i.test(uncommented)) report(name, '', 'Script or style was not converted')
    const safeHtml = uncommented.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    for (const match of safeHtml.matchAll(/<img\b[^>]*>/gi)) {
      const attribute = match[0].match(/(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i)
      report(name, attribute?.[1] ?? attribute?.[2] ?? attribute?.[3] ?? '(no source)', 'Image requires separate import')
    }
    // Source HTML stays inert in the retained WXR. Recognized structure becomes editable Markdown.
    const body = safeHtml.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_whole, attributes: string, inner: string) => {
      const match = attributes.match(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i)
      const href = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim().replace(/&amp;/gi, '&')
      const label = inner.replace(/<[^>]*>/g, '').replaceAll('[', '').replaceAll(']', '').trim()
      if (!label || !href || /[\\\p{Cc}\s)]/u.test(href) || href.startsWith('//')) { report(name, href || '(no destination)', 'Link was not converted'); return label }
      try {
        const url = new URL(href, link || siteUrl)
        const local = links.get(`${url.origin}${url.pathname}${url.search}`)
        if (local) {
          if (url.hash) report(name, href, 'Link fragment was omitted')
          return `[${label}](${local})`
        }
        if (/^https?:$/.test(url.protocol) && !url.username && !url.password) {
          if (url.origin === siteOrigin) report(name, href, 'Site link was not matched to an imported page')
          return `[${label}](${url.href})`
        }
      } catch { /* Unsupported destinations remain plain text. */ }
      report(name, href, 'Link was not converted')
      return label
    }).replace(/<h[12]\b[^>]*>/gi, '\n## ').replace(/<h[3-6]\b[^>]*>/gi, '\n### ').replace(/<\/(?:h[1-6])\s*>/gi, '\n').replace(/<\/?(?:p|div|br|li|blockquote)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").trim()
    const page: PageConfig = { id: `page-${crypto.randomUUID()}`, name, path, blocks: [{ id: `block-${crypto.randomUUID()}`, type: 'content', variant: 'prose', props: { body } }] }
    if (kind === 'post' || value('status', 'http://wordpress.org/export/') !== 'publish') {
      const tags = Array.from(item.children).filter(element => element.localName === 'category').map(element => element.textContent?.trim() ?? '').filter(Boolean)
      page.webstudioArticle = { status: 'draft', author: value('creator', 'http://purl.org/dc/elements/1.1/'), summary: '', tags, createdAt: value('post_date', 'http://wordpress.org/export/'), modifiedAt: value('post_modified', 'http://wordpress.org/export/') }
    }
    pages.push(page)
  }
  const config: SiteConfig = { name: title, pages, blocks: home.blocks }
  const project = createProjectFile(config, crypto.randomUUID())
  project.webstudioWordPressSource = source
  return { project, pages: pageCount, posts: postCount, skipped, issueCount, issues }
}
