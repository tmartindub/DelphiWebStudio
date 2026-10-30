import type { BlockConfig, PageConfig, SiteConfig } from '@/blocks/types'

export const portableProjectsEnabled = import.meta.env.VITE_WEBSTUDIO_PROJECTS === 'true'

export interface SiteProjectFile {
  format: 'webstudio'
  schemaVersion: 2
  projectId: string
  config: SiteConfig
  settings?: Record<string, unknown>
  [key: string]: unknown
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
  return value
}

function inspectContent(value: unknown, depth = 0): void {
  if (depth > 100) throw new Error('Project nesting is too deep.')
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Project numbers must be finite.')
  if (['function', 'symbol', 'bigint'].includes(typeof value)) throw new Error('Project values must be JSON-compatible.')
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new Error(`Unsafe project property: ${key}.`)
    }
    if (typeof child === 'string' && /(?:url|href|src|avatar|logoImage|heroImage)$/i.test(key)) {
      const url = child.trim()
      if (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|mailto:|tel:)/i.test(url)) {
        throw new Error(`Unsupported URL protocol in ${key}.`)
      }
      if (/\p{Cc}/u.test(url)) throw new Error(`Invalid characters in ${key}.`)
    }
    inspectContent(child, depth + 1)
  }
}

function pagePath(value: unknown): string {
  const path = text(value, 'Page path')
  if (!path.startsWith('/') || path.startsWith('//') || /[\\?#<>"|*\s\p{Cc}]/u.test(path)) {
    throw new Error(`Invalid page path: ${path}. Use a local path such as /about.`)
  }
  let decoded: string
  try { decoded = decodeURIComponent(path) } catch { throw new Error(`Invalid encoded page path: ${path}.`) }
  if (decoded !== path || path.split('/').some(segment => segment === '.' || segment === '..' || segment.includes(':'))) {
    throw new Error(`Unsafe page path: ${path}.`)
  }
  if (path.includes('//')) throw new Error(`Invalid repeated slash in page path: ${path}.`)
  if (path.split('/').some(segment => /\.$/.test(segment) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) {
    throw new Error(`Page path is not portable on Windows: ${path}.`)
  }
  return path === '/' ? path : path.replace(/\/$/, '')
}

/** Validate without discarding unknown JSON fields or component types. */
export function validateProjectConfig(value: unknown): SiteConfig {
  inspectContent(value)
  const source = record(value, 'Site config')
  text(source.name, 'Site name')
  const blockIds = new Set<string>()
  const readBlocks = (value: unknown): BlockConfig[] => {
    if (!Array.isArray(value)) throw new Error('Page blocks must be an array.')
    return value.map((item) => {
      const block = record(item, 'Block')
      const id = text(block.id, 'Block ID')
      if (blockIds.has(id)) throw new Error(`Duplicate block ID: ${id}.`)
      blockIds.add(id)
      text(block.type, 'Block type')
      text(block.variant, 'Block variant')
      record(block.props, 'Block properties')
      return structuredClone(block) as unknown as BlockConfig
    })
  }

  const pageIds = new Set<string>()
  const paths = new Set<string>()
  let pages: PageConfig[]
  if (source.pages !== undefined) {
    if (!Array.isArray(source.pages) || !source.pages.length) throw new Error('A project must contain at least one page.')
    pages = source.pages.map(item => {
      const page = record(item, 'Page')
      const id = text(page.id, 'Page ID')
      if (pageIds.has(id)) throw new Error(`Duplicate page ID: ${id}.`)
      pageIds.add(id)
      text(page.name, 'Page name')
      const path = pagePath(page.path)
      if (page.webstudioSeo !== undefined) {
        const seo = record(page.webstudioSeo, 'Page search metadata')
        if ((seo.title !== undefined && typeof seo.title !== 'string') || (seo.description !== undefined && typeof seo.description !== 'string')) throw new Error('Page search title and description must be text.')
      }
      if (paths.has(path.toLowerCase())) throw new Error(`Duplicate page path: ${path}.`)
      paths.add(path.toLowerCase())
      if (page.webstudioArticle !== undefined) {
        const article = record(page.webstudioArticle, 'Article metadata')
        if (article.status !== 'draft' && article.status !== 'ready') throw new Error('Invalid article status.')
        if (path === '/') throw new Error('The Home page cannot be an article.')
        for (const field of ['author', 'summary', 'createdAt', 'modifiedAt']) {
          if (typeof article[field] !== 'string') throw new Error(`Invalid article ${field}.`)
        }
        if (article.tags !== undefined && (!Array.isArray(article.tags) || article.tags.some(tag => typeof tag !== 'string' || !tag.trim()))) throw new Error('Article tags must be nonempty text.')
      }
      return { ...structuredClone(page), id, name: page.name as string, path, blocks: readBlocks(page.blocks) }
    })
    if (source.blocks !== undefined && (!Array.isArray(source.blocks) || !pages.some(page => JSON.stringify(page.blocks) === JSON.stringify(source.blocks)))) {
      throw new Error('Legacy blocks differ from every page. Resolve the conflicting content before saving.')
    }
  } else {
    pages = [{ id: 'page-home', name: 'Home', path: '/', blocks: readBlocks(source.blocks) }]
  }
  if (!pages.some(page => page.path === '/')) throw new Error('A Home page with path / is required.')

  if (source.theme !== undefined) {
    const theme = record(source.theme, 'Theme')
    for (const [key, value] of Object.entries(theme)) {
      if (/^(bg\d|text\d|accent|accentDim|borderDefault|borderSubtle|borderHover)$/.test(key) && (typeof value !== 'string' || !/^#[a-f\d]{6}$/i.test(value))) {
        throw new Error(`Invalid theme color: ${key}.`)
      }
      if (/^font(Sans|Display|Mono)$/.test(key) && (typeof value !== 'string' || !/^[\p{L}\p{N} .,_-]{1,100}$/u.test(value))) {
        throw new Error(`Invalid theme font: ${key}.`)
      }
      if (/^radius(Lg)?$/.test(key) && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) {
        throw new Error(`Invalid theme radius: ${key}.`)
      }
    }
  }
  const home = pages.find(page => page.path === '/')!
  return { ...structuredClone(source), name: source.name as string, pages, blocks: home.blocks } as SiteConfig
}

export function createProjectFile(config: SiteConfig, projectId: string): SiteProjectFile {
  return { format: 'webstudio', schemaVersion: 2, projectId: text(projectId, 'Project ID'), config: validateProjectConfig(config) }
}

/** Prevent portable saves and opens from silently losing referenced project media. */
export function validateProjectMedia(config: SiteConfig, assets: unknown[]): void {
  const assetIds = new Set<string>()
  const assetPaths = new Set<string>()
  const portablePaths = new Set<string>()
  const pathsById = new Map<string, string>()
  for (const value of assets) {
    const asset = record(value, 'Project media')
    const id = text(asset.id, 'Media ID')
    const path = text(asset.path, 'Media path')
    if (assetIds.has(id) || portablePaths.has(path.toLowerCase())) throw new Error('The project contains duplicate media IDs or paths.')
    assetIds.add(id)
    assetPaths.add(path)
    portablePaths.add(path.toLowerCase())
    pathsById.set(id, path)
  }
  const knownTypes = new Set(['navbar', 'hero', 'features', 'pricing', 'cta', 'footer', 'testimonials', 'stats', 'faq', 'team', 'contact', 'newsletter', 'logocloud', 'divider', 'banner', 'content', 'image', 'video', 'gallery', 'pdfViewer', 'document', 'audio', 'mediaVideo'])
  const blocks = config.pages ? config.pages.flatMap(page => page.blocks) : config.blocks
  for (const block of blocks) {
    if (!knownTypes.has(block.type)) continue
    if (block.type === 'content' && typeof block.props.body === 'string') {
      for (const match of block.props.body.matchAll(/\]\((assets\/[a-zA-Z0-9._-]+)(?:[?#][^)\s]*)?\)/g)) {
        if (!assetPaths.has(match[1])) throw new Error(`Missing project media file: ${match[1]}.`)
      }
    }
    if (['image', 'pdfViewer', 'document', 'audio', 'mediaVideo'].includes(block.type) && typeof block.props.assetId === 'string' && pathsById.has(block.props.assetId) && block.props.src !== pathsById.get(block.props.assetId)) {
      throw new Error(`Media ID and path do not match: ${block.props.assetId}.`)
    }
    const pending: unknown[] = [block.props]
    while (pending.length) {
      const value = pending.pop()
      if (!value || typeof value !== 'object') continue
      if (!Array.isArray(value)) {
        const entry = value as Record<string, unknown>
        if (typeof entry.assetId === 'string' && typeof entry.src === 'string' && pathsById.has(entry.assetId) && pathsById.get(entry.assetId) !== entry.src) {
          throw new Error(`Media ID and path do not match: ${entry.assetId}.`)
        }
        if (block.type === 'features' && typeof entry.assetId === 'string' && typeof entry.image === 'string' && pathsById.has(entry.assetId) && pathsById.get(entry.assetId) !== entry.image) {
          throw new Error(`Media ID and path do not match: ${entry.assetId}.`)
        }
        if (block.type === 'team' && typeof entry.assetId === 'string' && typeof entry.avatar === 'string' && pathsById.has(entry.assetId) && pathsById.get(entry.assetId) !== entry.avatar) {
          throw new Error(`Media ID and path do not match: ${entry.assetId}.`)
        }
      }
      for (const [key, child] of Object.entries(value)) {
        if (key === 'assetId' && typeof child === 'string' && child && !assetIds.has(child)) throw new Error(`Missing project media ID: ${child}.`)
        if (/^(src|href|url|image|logoImage|heroImage|avatar)$/i.test(key) && typeof child === 'string' && child.startsWith('assets/') && !assetPaths.has(child)) {
          throw new Error(`Missing project media file: ${child}.`)
        }
        if (child && typeof child === 'object') pending.push(child)
      }
    }
  }
}

export function parseProjectFile(contents: string): { project: SiteProjectFile; migrated: boolean } {
  let raw: unknown
  try { raw = JSON.parse(contents) } catch { throw new Error('The selected file is not valid JSON.') }
  inspectContent(raw)
  const source = record(raw, 'Project')
  if (source.format !== undefined || source.config !== undefined) {
    if (source.format !== 'webstudio' || source.schemaVersion !== 2) {
      throw new Error('Unsupported project format or schema version. The original file has not been changed.')
    }
    const projectId = text(source.projectId, 'Project ID')
    if (source.settings !== undefined) {
      const settings = record(source.settings, 'Project settings')
      if ('deployAccessKey' in settings) throw new Error('Remove the deployment credential from the project file before opening it.')
    }
    return {
      project: { ...structuredClone(source), format: 'webstudio', schemaVersion: 2, projectId, config: validateProjectConfig(source.config) },
      migrated: false,
    }
  }
  return { project: createProjectFile(validateProjectConfig(source), crypto.randomUUID()), migrated: true }
}

export function serializeProjectFile(project: SiteProjectFile): string {
  if (project.format !== 'webstudio' || project.schemaVersion !== 2) throw new Error('Unsupported project format or schema version.')
  text(project.projectId, 'Project ID')
  if (project.settings !== undefined && 'deployAccessKey' in record(project.settings, 'Project settings')) {
    throw new Error('Deployment credentials cannot be saved in a project file.')
  }
  inspectContent(project)
  return JSON.stringify({ ...project, config: validateProjectConfig(project.config) }, null, 2) + '\n'
}
