import type { BlockConfig, SiteConfig, ThemeConfig } from '@/blocks/types'
import { validateProjectConfig } from '@/project/project-file'

export type SiteAction =
  | { op: 'createPage'; pageId: string; name: string; path: string }
  | { op: 'renamePage'; pageId: string; name: string }
  | { op: 'setThemeTokens'; tokens: Partial<Pick<ThemeConfig, 'bg0' | 'bg1' | 'bg2' | 'bg3' | 'bg4' | 'bg5' | 'text0' | 'text1' | 'text2' | 'text3' | 'accent' | 'accentDim' | 'borderDefault' | 'borderSubtle' | 'borderHover'>> }
  | { op: 'addBlock'; pageId: string; block: { id: string; type: 'hero' | 'content'; variant: string; props: Record<string, string> } }
  | { op: 'modifyBlockProps'; pageId: string; blockId: string; props: Record<string, string> }
  | { op: 'moveBlock'; pageId: string; blockId: string; index: number }
  | { op: 'removeBlock'; pageId: string; blockId: string }

export interface SiteActionRequest {
  schemaVersion: 1
  requestId: string
  mode: 'preview'
  operations: SiteAction[]
}

export interface SiteActionPreview {
  requestId: string
  baseSnapshot: string
  proposedSnapshot: string
  proposedConfig: SiteConfig
  changes: readonly string[]
}

/** Turn an untrusted five-page plan into the existing review-only action flow.
 * Only a blank single-page project can be used, so existing content is not replaced. */
export function previewFivePagePlan(config: SiteConfig, input: unknown, requestId: string): SiteActionPreview {
  const current = validateProjectConfig(config)
  const pages = current.pages!
  if (pages.length !== 1 || pages[0].path !== '/' || pages[0].blocks.length !== 0) throw new Error('A five-page plan requires a blank project with only an empty Home page.')
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'pages')) throw new Error('Invalid five-page plan.')
  const planned = (input as Record<string, unknown>).pages
  if (!Array.isArray(planned) || planned.length !== 5) throw new Error('The plan must contain exactly five pages.')
  const operations: SiteAction[] = []
  const paths = new Set<string>(['/'])
  for (const [index, value] of planned.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['name', 'headline'].includes(key)) || typeof value.name !== 'string' || typeof value.headline !== 'string') throw new Error('Invalid page in plan.')
    const name = value.name.trim()
    const headline = value.headline.trim()
    if (!name || name.length > 120 || !headline || headline.length > 4000 || /\p{Cc}/u.test(name + headline)) throw new Error('Invalid page name or headline in plan.')
    const pageId = index === 0 ? pages[0].id : crypto.randomUUID()
    if (index === 0) operations.push({ op: 'renamePage', pageId, name })
    else {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '')
      const path = `/${slug}`
      if (!slug || paths.has(path)) throw new Error('Page names must produce distinct usable addresses.')
      paths.add(path)
      operations.push({ op: 'createPage', pageId, name, path })
    }
    operations.push({ op: 'addBlock', pageId, block: { id: crypto.randomUUID(), type: 'hero', variant: 'centered', props: { headline } } })
  }
  return previewSiteActions(current, { schemaVersion: 1, requestId, mode: 'preview', operations })
}

/** A proposal is evaluated on a copy and never edits the active project. */
export function previewSiteActions(config: SiteConfig, input: unknown): SiteActionPreview {
  const request = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null
  if (!request || Object.keys(request).some(key => !['schemaVersion', 'requestId', 'mode', 'operations'].includes(key)) || request.schemaVersion !== 1 || request.mode !== 'preview' || typeof request.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(request.requestId) || !Array.isArray(request.operations) || request.operations.length < 1 || request.operations.length > 50) {
    throw new Error('Invalid action proposal.')
  }
  let size: number
  try { size = JSON.stringify(input).length } catch { throw new Error('Action proposal must be JSON-compatible.') }
  if (size > 200_000) throw new Error('Action proposal is too large.')
  const candidate = validateProjectConfig(config)
  const baseSnapshot = JSON.stringify(candidate)
  const pages = candidate.pages!
  const changes: string[] = []
  const allowedProps: Record<string, string[]> = {
    hero: ['headline', 'subheadline', 'primaryCta', 'secondaryCta', 'badge'],
    content: ['body'],
  }
  const allowedVariants: Record<string, string[]> = { hero: ['centered', 'split', 'gradient', 'minimal'], content: ['prose', 'columns', 'highlight'] }

  for (const item of request.operations) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid action.')
    const action = item as Record<string, unknown>
    if (typeof action.op !== 'string') throw new Error('Invalid action type.')
    const operationName = action.op
    const allowedKeys: Record<string, string[]> = {
      createPage: ['op', 'pageId', 'name', 'path'], renamePage: ['op', 'pageId', 'name'],
      setThemeTokens: ['op', 'tokens'], addBlock: ['op', 'pageId', 'block'],
      modifyBlockProps: ['op', 'pageId', 'blockId', 'props'], moveBlock: ['op', 'pageId', 'blockId', 'index'],
      removeBlock: ['op', 'pageId', 'blockId'],
    }
    if (!Object.hasOwn(allowedKeys, operationName) || Object.keys(action).some(key => !allowedKeys[operationName].includes(key))) throw new Error(`Unsupported or malformed action: ${operationName}.`)
    if (action.op === 'setThemeTokens') {
      if (!action.tokens || typeof action.tokens !== 'object' || Array.isArray(action.tokens)) throw new Error('Invalid theme tokens.')
      const tokens = action.tokens as Record<string, unknown>
      if (!Object.keys(tokens).length || Object.entries(tokens).some(([key, value]) => !/^(bg[0-5]|text[0-3]|accent|accentDim|borderDefault|borderSubtle|borderHover)$/.test(key) || typeof value !== 'string' || !/^#[a-f\d]{6}$/i.test(value))) throw new Error('Only six-digit theme colors are supported.')
      candidate.theme = { ...candidate.theme, ...tokens } as Partial<ThemeConfig>
      changes.push('Change theme colors')
      continue
    }
    if (typeof action.pageId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(action.pageId)) throw new Error('Invalid page ID.')
    if (action.op === 'createPage') {
      if (pages.some(page => page.id === action.pageId) || typeof action.name !== 'string' || !action.name.trim() || action.name.length > 120 || typeof action.path !== 'string' || action.path.length > 250) throw new Error('Invalid new page.')
      pages.push({ id: action.pageId, name: action.name.trim(), path: action.path, blocks: [] })
      changes.push(`Create page: ${action.name.trim()}`)
      continue
    }
    const page = pages.find(value => value.id === action.pageId)
    if (!page) throw new Error('The action references a missing page.')
    if (action.op === 'renamePage') {
      if (typeof action.name !== 'string' || !action.name.trim() || action.name.length > 120) throw new Error('Invalid page name.')
      changes.push(`Rename ${page.name} to ${action.name.trim()}`)
      page.name = action.name.trim()
      continue
    }
    if (action.op === 'addBlock') {
      if (!action.block || typeof action.block !== 'object' || Array.isArray(action.block)) throw new Error('Invalid block.')
      const block = action.block as Record<string, unknown>
      if (Object.keys(block).some(key => !['id', 'type', 'variant', 'props'].includes(key)) || typeof block.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(block.id) || typeof block.type !== 'string' || !Object.hasOwn(allowedProps, block.type) || typeof block.variant !== 'string' || !allowedVariants[block.type].includes(block.variant) || !block.props || typeof block.props !== 'object' || Array.isArray(block.props)) throw new Error('Unsupported block.')
      const props = block.props as Record<string, unknown>
      if (Object.entries(props).some(([key, value]) => !allowedProps[block.type as string].includes(key) || typeof value !== 'string' || value.length > 4000)) throw new Error('Unsupported block property.')
      if (typeof props[block.type === 'hero' ? 'headline' : 'body'] !== 'string' || !(props[block.type === 'hero' ? 'headline' : 'body'] as string).trim()) throw new Error('A new block needs content.')
      page.blocks.push({ id: block.id, type: block.type as BlockConfig['type'], variant: block.variant, props: structuredClone(props) })
      changes.push(`Add ${block.type} to ${page.name}`)
      continue
    }
    if (typeof action.blockId !== 'string') throw new Error('Invalid block ID.')
    const blockIndex = page.blocks.findIndex(block => block.id === action.blockId)
    if (blockIndex < 0) throw new Error('The action references a missing block.')
    const block = page.blocks[blockIndex]
    if (action.op === 'modifyBlockProps') {
      if (!Object.hasOwn(allowedProps, block.type) || !action.props || typeof action.props !== 'object' || Array.isArray(action.props)) throw new Error('Unsupported block properties.')
      const props = action.props as Record<string, unknown>
      if (!Object.keys(props).length || Object.entries(props).some(([key, value]) => !allowedProps[block.type].includes(key) || typeof value !== 'string' || value.length > 4000)) throw new Error('Unsupported block property.')
      block.props = { ...block.props, ...structuredClone(props) }
      changes.push(`Edit ${block.type} on ${page.name}`)
    } else if (action.op === 'moveBlock') {
      if (!Number.isInteger(action.index) || (action.index as number) < 0 || (action.index as number) >= page.blocks.length) throw new Error('Invalid block position.')
      page.blocks.splice(blockIndex, 1)
      page.blocks.splice(action.index as number, 0, block)
      changes.push(`Move ${block.type} on ${page.name}`)
    } else if (action.op === 'removeBlock') {
      if (!Object.hasOwn(allowedProps, block.type)) throw new Error('This block type cannot be removed by an action.')
      page.blocks.splice(blockIndex, 1)
      changes.push(`Remove ${block.type} from ${page.name}`)
    }
  }
  candidate.blocks = pages.find(page => page.path === '/')!.blocks
  const proposedConfig = validateProjectConfig(candidate)
  return Object.freeze({ requestId: request.requestId, baseSnapshot, proposedSnapshot: JSON.stringify(proposedConfig), proposedConfig, changes: Object.freeze(changes) })
}

/** Return the reviewed result only if the source project has not changed. */
export function acceptSiteActions(current: SiteConfig, preview: SiteActionPreview): SiteConfig {
  if (JSON.stringify(validateProjectConfig(current)) !== preview.baseSnapshot) throw new Error('The project changed; review a new proposal.')
  const proposed = validateProjectConfig(preview.proposedConfig)
  if (JSON.stringify(proposed) !== preview.proposedSnapshot) throw new Error('The proposal changed; review it again.')
  return proposed
}
