import type { PageConfig, SiteConfig } from '@/blocks/types'
import { createProjectFile, type SiteProjectFile } from './project-file'

/** Convert WordPress WXR content to editable text while retaining the original export as inert project data. */
export function importWordPressXml(source: string): { project: SiteProjectFile; pages: number; posts: number; skipped: number } {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source)) throw new Error('WordPress XML with a document type or entity declaration is not supported.')
  const document = new DOMParser().parseFromString(source, 'application/xml')
  if (document.getElementsByTagName('parsererror').length || document.documentElement.localName !== 'rss') throw new Error('The selected file is not valid WordPress XML.')
  const channel = Array.from(document.documentElement.children).find(element => element.localName === 'channel')
  if (!channel || !Array.from(channel.children).some(element => element.localName === 'wxr_version' && element.namespaceURI?.startsWith('http://wordpress.org/export/'))) throw new Error('The file is not a WordPress WXR export.')
  const items = Array.from(channel.children).filter(element => element.localName === 'item')
  if (items.length > 500) throw new Error('This export has more than 500 items. Split it into smaller WordPress exports.')
  const title = Array.from(channel.children).find(element => element.localName === 'title')?.textContent?.trim() || 'Imported WordPress site'
  const home: PageConfig = { id: `page-${crypto.randomUUID()}`, name: 'Home', path: '/', blocks: [] }
  const pages: PageConfig[] = [home]
  let postCount = 0, pageCount = 0, skipped = 0
  for (const item of items) {
    const value = (name: string, namespace?: string) => Array.from(item.children).find(element => element.localName === name && (!namespace || element.namespaceURI?.startsWith(namespace)))?.textContent ?? ''
    const kind = value('post_type', 'http://wordpress.org/export/')
    if (kind !== 'post' && kind !== 'page') { skipped++; continue }
    if (kind === 'post') postCount++; else pageCount++
    const name = value('title').trim() || `Imported ${kind} ${kind === 'post' ? postCount : pageCount}`
    const html = value('encoded', 'http://purl.org/rss/1.0/modules/content/')
    // Source HTML stays inert in the retained WXR. Only plain text enters editable blocks.
    const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<\/?(?:p|div|br|li|h[1-6]|blockquote)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").trim()
    const page: PageConfig = { id: `page-${crypto.randomUUID()}`, name, path: `/imported-${kind}-${kind === 'post' ? postCount : pageCount}`, blocks: [{ id: `block-${crypto.randomUUID()}`, type: 'content', variant: 'prose', props: { body } }] }
    if (kind === 'post') {
      const tags = Array.from(item.children).filter(element => element.localName === 'category').map(element => element.textContent?.trim() ?? '').filter(Boolean)
      page.webstudioArticle = { status: 'draft', author: value('creator', 'http://purl.org/dc/elements/1.1/'), summary: '', tags, createdAt: value('post_date', 'http://wordpress.org/export/'), modifiedAt: value('post_modified', 'http://wordpress.org/export/') }
    }
    pages.push(page)
  }
  if (!postCount && !pageCount) throw new Error('No WordPress posts or pages were found. The original file was not changed.')
  const config: SiteConfig = { name: title, pages, blocks: home.blocks }
  const project = createProjectFile(config, crypto.randomUUID())
  project.webstudioWordPressSource = source
  return { project, pages: pageCount, posts: postCount, skipped }
}
