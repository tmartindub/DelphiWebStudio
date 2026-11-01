import type { BlockConfig, PageConfig, SiteConfig } from '@/blocks/types'
import { createProjectFile, type SiteProjectFile } from './project-file'

/** Import text without parsing or executing the selected site's HTML in the editor. */
export function importStaticHtml(files: { path: string; text: string }[], skipped: number, images: { sourcePath: string; assetId: string; assetPath: string }[] = []): { project: SiteProjectFile; pages: number; stylesheets: number; skipped: number; issueCount: number; issues: { source: string; reference: string; reason: string }[] } {
  const htmlFiles = files.filter(file => /\.html?$/i.test(file.path)).sort((a, b) => a.path.localeCompare(b.path))
  if (!htmlFiles.length) throw new Error('No HTML pages were found in the selected folder.')
  if (htmlFiles.length > 100) throw new Error('This folder has more than 100 HTML pages. Select a smaller site.')
  const homeIndex = htmlFiles.reduce((best, file, index) => /(?:^|\/)index\.html?$/i.test(file.path) && (best < 0 || file.path.split('/').length < htmlFiles[best].path.split('/').length) ? index : best, -1)
  if (homeIndex > 0) htmlFiles.unshift(htmlFiles.splice(homeIndex, 1)[0])
  const pagePaths = new Map(htmlFiles.map((file, index) => [file.path, index === 0 ? '/' : `/imported-page-${index + 1}`]))
  const imagePaths = new Map(images.map(image => [image.sourcePath, image]))
  const issues: { source: string; reference: string; reason: string }[] = []
  let issueCount = 0
  function report(source: string, reference: string, reason: string) {
    issueCount++
    if (issues.length < 100) issues.push({ source, reference: reference.slice(0, 200), reason })
  }
  const allPaths = [...files.map(file => file.path), ...images.map(image => image.sourcePath)]
  const firstPart = allPaths[0]?.split('/')[0]
  const root = firstPart && allPaths.every(path => path.startsWith(`${firstPart}/`)) ? `${firstPart}/` : ''
  function resolve(from: string, reference: string): string | null {
    const value = reference.trim().replace(/&amp;/gi, '&')
    if (!value || /[\\\p{Cc}]/u.test(value) || value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)) return null
    try {
      const base = `https://static-import.invalid/${from.split('/').map(encodeURIComponent).join('/')}`
      const url = new URL(value.startsWith('/') ? `/${root}${value.slice(1)}` : value, base)
      if (url.origin !== 'https://static-import.invalid') return null
      return decodeURIComponent(url.pathname.slice(1))
    } catch { return null }
  }
  function attribute(tag: string, name: string): string {
    const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\u0060]+))`, 'i'))
    return match?.[1] ?? match?.[2] ?? match?.[3] ?? ''
  }
  const pages: PageConfig[] = htmlFiles.map((file, index) => {
    const title = file.text.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1].replace(/<[^>]*>/g, '').trim()
    const name = title || file.path.split('/').pop() || `Imported page ${index + 1}`
    const bodySource = file.text.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? file.text
    const safeSource = bodySource.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    const blocks: BlockConfig[] = []
    const parts = safeSource.split(/(<img\b[^>]*>)/gi)
    for (const part of parts) {
      if (/^<img\b/i.test(part)) {
        const src = attribute(part, 'src')
        const path = resolve(file.path, src)
        const image = path ? imagePaths.get(path) : undefined
        if (image) blocks.push({ id: `block-${crypto.randomUUID()}`, type: 'image', variant: 'hero-image', props: { assetId: image.assetId, src: image.assetPath, alt: attribute(part, 'alt') } })
        else report(file.path, src || '(no source)', 'Image was not placed')
        continue
      }
      const body = part.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (whole, attributes: string, inner: string) => {
        const href = attribute(attributes, 'href')
        const path = resolve(file.path, href)
        const destination = path ? pagePaths.get(path) : undefined
        const label = inner.replace(/<[^>]*>/g, '').replaceAll('[', '').replaceAll(']', '').trim()
        if (!destination || !label) report(file.path, href || '(no destination)', 'Link was not converted')
        else if (/[?#]/.test(href)) report(file.path, href, 'Link query or fragment was omitted')
        return destination && label ? `[${label}](${destination})` : whole
      }).replace(/<h[12]\b[^>]*>/gi, '\n## ').replace(/<h[3-6]\b[^>]*>/gi, '\n### ').replace(/<\/h[1-6]\s*>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '\n- ').replace(/<\/li\s*>/gi, '\n')
        .replace(/<\/?(?:strong|b)\b[^>]*>/gi, '**').replace(/<\/?(?:em|i)\b[^>]*>/gi, '*')
        .replace(/<\/?(?:p|div|br|blockquote)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").trim()
      if (body) blocks.push({ id: `block-${crypto.randomUUID()}`, type: 'content', variant: 'prose', props: { body } })
    }
    const supportedTags = new Set(['a', 'p', 'div', 'br', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'img'])
    const markup = bodySource.replace(/<!--[\s\S]*?-->/g, '')
    if ([...markup.matchAll(/<\s*\/?\s*([a-z][a-z\d-]*)\b[^>]*>/gi)].some(match => !supportedTags.has(match[1].toLowerCase()))) {
      blocks.push({ id: `block-${crypto.randomUUID()}`, type: 'content', variant: 'imported-source', props: { rawHtml: bodySource, sourcePath: file.path } })
    }
    return { id: `page-${crypto.randomUUID()}`, name, path: index === 0 ? '/' : `/imported-page-${index + 1}`, blocks }
  })
  const config: SiteConfig = { name: pages[0].name, pages, blocks: pages[0].blocks }
  const project = createProjectFile(config, crypto.randomUUID())
  project.webstudioStaticSource = files
  return { project, pages: pages.length, stylesheets: files.length - htmlFiles.length, skipped, issueCount, issues }
}
