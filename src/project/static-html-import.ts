import type { PageConfig, SiteConfig } from '@/blocks/types'
import { createProjectFile, type SiteProjectFile } from './project-file'

/** Import text without parsing or executing the selected site's HTML in the editor. */
export function importStaticHtml(files: { path: string; text: string }[], skipped: number): { project: SiteProjectFile; pages: number; stylesheets: number; skipped: number } {
  const htmlFiles = files.filter(file => /\.html?$/i.test(file.path)).sort((a, b) => a.path.localeCompare(b.path))
  if (!htmlFiles.length) throw new Error('No HTML pages were found in the selected folder.')
  if (htmlFiles.length > 100) throw new Error('This folder has more than 100 HTML pages. Select a smaller site.')
  const homeIndex = htmlFiles.reduce((best, file, index) => /(?:^|\/)index\.html?$/i.test(file.path) && (best < 0 || file.path.split('/').length < htmlFiles[best].path.split('/').length) ? index : best, -1)
  if (homeIndex > 0) htmlFiles.unshift(htmlFiles.splice(homeIndex, 1)[0])
  const pages: PageConfig[] = htmlFiles.map((file, index) => {
    const title = file.text.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1].replace(/<[^>]*>/g, '').trim()
    const name = title || file.path.split('/').pop() || `Imported page ${index + 1}`
    const bodySource = file.text.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? file.text
    const body = bodySource.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<\/?(?:p|div|br|li|h[1-6]|blockquote)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").trim()
    return { id: `page-${crypto.randomUUID()}`, name, path: index === 0 ? '/' : `/imported-page-${index + 1}`, blocks: [{ id: `block-${crypto.randomUUID()}`, type: 'content', variant: 'prose', props: { body } }] }
  })
  const config: SiteConfig = { name: pages[0].name, pages, blocks: pages[0].blocks }
  const project = createProjectFile(config, crypto.randomUUID())
  project.webstudioStaticSource = files
  return { project, pages: pages.length, stylesheets: files.length - htmlFiles.length, skipped }
}
