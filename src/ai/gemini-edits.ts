import type { BlockConfig, SiteConfig } from '@/blocks/types'
import { blockFields } from '@/blocks/editable-fields'
import { blockMetadata } from '@/lib/block-metadata'
import { validateProjectConfig } from '@/project/project-file'
import { visitBlockLinks, pageLinkPath } from '@/project/page-links'
import { isValidElement, type ReactNode } from 'react'
import { renderMarkdown } from '@/lib/markdown'

export type EditScope = { pageId: string; target: string }
export type EditOperation = { action: 'set' | 'textStyle' | 'addObject' | 'addBlock' | 'move' | 'remove' | 'setMedia' | 'addItem' | 'linkText'; target: string; field: string; value: string }
export type EditMedia = { id: string; name: string; path: string; mime: string; folder?: string; width?: number; height?: number }
export type EditPlan = { summary: string; operations: EditOperation[] }
export type EditPreview = { before: string; after: string; config: SiteConfig; changes: string[]; affectedPages: string[] }
type Value = Record<string, unknown>
export type EditTarget = { id: string; label: string; kind: 'page' | 'block' | 'object' | 'item'; blockId?: string; section?: number; objectId?: string; parentId?: string; itemPath?: (string | number)[]; fields: Value; collections?: Record<string, string[]> }
const record = (value: unknown): value is Value => !!value && typeof value === 'object' && !Array.isArray(value)
const hex = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
const bounded = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const text = (value: unknown, max = 24000): value is string => typeof value === 'string' && value.length <= max && !/\p{Cc}/u.test(value.replace(/[\n\r\t]/g, ''))
const geometry: Record<string, [number, number]> = { layoutWidth: [5, 100], layoutHeight: [40, 2000], layoutLeft: [0, 95], layoutTop: [-2000, 2000], layoutLayer: [1, 100], height: [1, 20000], headlineOffsetX: [-2000, 2000], headlineOffsetY: [-2000, 20000], headlineWidth: [24, 4000], headlineHeight: [24, 10000], subheadlineOffsetX: [-2000, 2000], subheadlineOffsetY: [-2000, 20000], subheadlineWidth: [24, 4000], subheadlineHeight: [24, 10000] }
const colors = new Set(['blockBackgroundColor', 'textColor', 'buttonBackgroundColor', 'buttonTextColor', 'buttonBorderColor'])
const forbidden = /(?:endpoint|recipient|password|secret|api.?key|token|^script$|javascript|html|^css$|^source|^__|prototype|constructor)/i
const objectFields = new Set(['text', 'alt', 'x', 'y', 'width', 'height', 'layer', 'color', 'backgroundColor', 'textColor', 'borderColor', 'fontSize'])
const objectBounds: Record<string, [number, number]> = { x: [0, 99], y: [0, 20000], width: [1, 100], height: [24, 10000], layer: [0, 1000], fontSize: [6, 200] }
const styleKeys = new Set(['font', 'size', 'color', 'bold', 'italic', 'underline', 'align', 'lineHeight', 'spaceBefore', 'spaceAfter', 'indentLeft', 'indentRight', 'firstLineIndent'])
const itemFields: Record<string, Record<string, string[]>> = {
  gallery: { images: ['alt', 'caption', 'title', 'src'] }, collage: { images: ['alt', 'caption', 'src', 'x', 'y', 'width', 'height', 'layer'] },
  image: { images: ['src', 'alt', 'title', 'caption'] }, team: { members: ['name', 'role', 'bio', 'avatar'] },
  features: { items: ['icon', 'title', 'description', 'image'] }, faq: { items: ['question', 'answer'] },
  testimonials: { items: ['quote', 'name', 'role', 'avatar'] }, stats: { items: ['value', 'label'] },
  pricing: { tiers: ['name', 'price', 'period', 'description', 'features', 'cta', 'featured'] },
  documentLibrary: { items: ['title', 'description', 'src'] },
  calendar: { events: ['title', 'date', 'time', 'location', 'details'] },
  navbar: { navItems: ['label', 'url', 'children'] },
  footer: { navItems: ['label', 'url'], resources: ['src', 'alt', 'title', 'description', 'url'], resourceButtons: ['label', 'url'], columns: ['title', 'links'] },
}
const mediaFields = new Set(['src', 'image', 'avatar', 'heroImage', 'logoImage'])
function collections(block: BlockConfig): Record<string, string[]> {
  return { ...(itemFields[block.type] ?? {}), placedMedia: ['name', 'src', 'x', 'y', 'width'] }
}
function fieldsForItem(item: Value, keys: string[]): Value {
  return Object.fromEntries(keys.filter(key => key !== 'children').map(key => [key, { kind: mediaFields.has(key) ? 'media' : key === 'url' ? 'link' : key === 'featured' ? 'checkbox' : ['x', 'y', 'width', 'height', 'layer'].includes(key) ? 'number' : ['features', 'links'].includes(key) ? 'strings' : 'text', value: mediaFields.has(key) ? '(existing media)' : item[key] ?? '' }]))
}

function destination(config: SiteConfig, pageId: string, value: unknown, media: readonly EditMedia[], checkAnchor = false): string {
  if (!text(value, 2000) || /[\\\s<>"]/u.test(value) || value.startsWith('//')) throw new Error('Use a valid page address, anchor, approved media file or full HTTPS link.')
  if (!value) return ''
  if (/^assets\//.test(value)) { if (!media.some(asset => asset.path === value)) throw new Error('This file is not in the approved media catalog.'); return value }
  if (value.startsWith('/') || value.startsWith('#')) {
    const page = value.startsWith('#') ? config.pages!.find(item => item.id === pageId) : config.pages!.find(item => item.path.replace(/\/$/, '') === pageLinkPath(value))
    if (!page || page.webstudioArticle?.status === 'draft') throw new Error('That internal page is missing or is a draft.')
    const fragment = value.includes('#') ? value.slice(value.indexOf('#') + 1) : ''
    if (fragment && !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(fragment)) throw new Error('Use a valid anchor name.')
    if (fragment && checkAnchor && !page.blocks.some(block => block.props.anchorName === fragment || [1, 2, 3, 4].some(section => Array.isArray(block.props['section' + section + 'Objects']) && (block.props['section' + section + 'Objects'] as Value[]).some(object => object.anchorName === fragment)))) throw new Error('The linked anchor does not exist on that page.')
    return value
  }
  if (/^tel:\+?[\d()-]+$/.test(value)) return value
  try {
    const parsed = new URL(value)
    if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) {
      if (parsed.hostname === 'webstudio.local') return destination(config, pageId, parsed.pathname + parsed.search + parsed.hash, media, checkAnchor)
      return value
    }
  } catch { /* Rejected below. */ }
  throw new Error('Only HTTP/HTTPS, telephone, approved project media and existing site destinations are allowed. Email delivery settings remain manual.')
}
function mediaFor(catalog: readonly EditMedia[], id: unknown, field: string, block: BlockConfig, allowAny = false) {
  const asset = catalog.find(item => item.id === id)
  if (!asset || !/^assets\/[a-zA-Z0-9._-]+$/.test(asset.path)) throw new Error('Choose an existing file from the approved media catalog.')
  const expected = field === 'src' && (block.type === 'pdfViewer' || block.type === 'documentLibrary' && block.variant === 'weekly-bulletins') ? 'application/pdf' : field === 'src' && block.type === 'audio' ? 'audio/' : field === 'src' && block.type === 'mediaVideo' ? 'video/' : 'image/'
  if (!allowAny && block.type !== 'document' && !(block.type === 'documentLibrary' && block.variant !== 'weekly-bulletins') && !asset.mime.startsWith(expected)) throw new Error('This media type does not fit the selected component.')
  return asset
}

export function editableBlockFields(block: BlockConfig): Value {
  const fields: Value = {}
  for (const field of blockFields[block.type]?.sections.flatMap(section => section.fields) ?? []) {
    if (forbidden.test(field.key) || ['array-items', 'array-strings', 'image', 'link'].includes(field.type) || field.key === 'url') continue
    fields[field.key] = { label: field.label, kind: field.type, value: block.props[field.key] ?? '', ...(field.options ? { options: field.options } : {}) }
  }
  for (const key of colors) fields[key] = { kind: 'color', value: block.props[key] ?? '' }
  for (const [key, bounds] of Object.entries(geometry)) if (key.startsWith('layout') || block.type === 'hero' || key in block.props) fields[key] = { kind: 'number', min: bounds[0], max: bounds[1], value: block.props[key] ?? null }
  for (const key of ['bodyAlign', 'headlineAlign', 'subheadlineAlign']) if (key === 'bodyAlign' || block.type === 'hero') fields[key] = { kind: 'select', options: ['left', 'center', 'right', 'justify'], value: block.props[key] ?? 'left' }
  for (const item of blockFields[block.type]?.sections.flatMap(section => section.fields) ?? []) {
    if (item.type === 'link' || block.type === 'video' && item.key === 'url') fields[item.key] = { kind: 'link', value: block.props[item.key] ?? '' }
    if (item.type === 'array-strings') fields[item.key] = { kind: 'strings', value: block.props[item.key] ?? [] }
  }
  fields.anchorName = { kind: 'anchor', value: block.props.anchorName ?? '' }
  for (const item of blockFields[block.type]?.sections.flatMap(section => section.fields) ?? []) if (item.type === 'image') fields[item.key] = { kind: 'media', value: '(existing media)' }
  if (['image', 'panel', 'pdfViewer', 'document', 'audio', 'mediaVideo'].includes(block.type)) fields.src = { kind: 'media', value: '(existing media)' }
  return fields
}

export function editTargets(config: SiteConfig, pageId: string): EditTarget[] {
  const page = config.pages?.find(item => item.id === pageId)
  if (!page) throw new Error('The selected page no longer exists.')
  const targets: EditTarget[] = [{ id: 'page:' + page.id, kind: 'page', label: page.name + ' — whole page', fields: { name: { kind: 'text', value: page.name }, path: { kind: 'pagePath', value: page.path } } }]
  for (const [index, block] of page.blocks.entries()) {
    const label = String(block.props.title || block.props.headline || block.props.logo || block.props.body || block.type).slice(0, 75).replace(/\s+/g, ' ')
    targets.push({ id: 'block:' + block.id, kind: 'block', blockId: block.id, label: (index + 1) + '. ' + block.type + ': ' + label, fields: editableBlockFields(block), collections: collections(block) })
    for (const [field, keys] of Object.entries(collections(block))) {
      const list = Array.isArray(block.props[field]) ? block.props[field] as unknown[] : []
      list.forEach((item, itemIndex) => {
        if (!record(item)) return
        const id = 'item:' + block.id + ':' + field + ':' + String(item.id || itemIndex)
        targets.push({ id, kind: 'item', blockId: block.id, itemPath: [field, itemIndex], label: block.type + ' ' + field + ' #' + (itemIndex + 1) + ': ' + String(item.title || item.name || item.alt || item.caption || item.label || item.question || '').slice(0, 65), fields: fieldsForItem(item, keys), ...(block.type === 'navbar' && field === 'navItems' ? { collections: { children: ['label', 'url'] } } : {}) })
        if (block.type === 'navbar' && field === 'navItems' && Array.isArray(item.children)) item.children.forEach((child, childIndex) => { if (record(child)) targets.push({ id: id + ':children:' + String(child.id || childIndex), kind: 'item', blockId: block.id, parentId: id, itemPath: [field, itemIndex, 'children', childIndex], label: 'Submenu: ' + String(child.label || ''), fields: fieldsForItem(child, ['label', 'url']) }) })
      })
    }
    for (const section of [1, 2, 3, 4]) for (const object of Array.isArray(block.props['section' + section + 'Objects']) ? block.props['section' + section + 'Objects'] as Value[] : []) {
      if (!record(object) || typeof object.id !== 'string') continue
      const fields: Value = {}
      for (const key of objectFields) fields[key] = { value: key === 'text' ? block.props['sectionObject_' + object.id] ?? object.text ?? '' : object[key] ?? '', ...(objectBounds[key] ? { kind: 'number', min: objectBounds[key][0], max: objectBounds[key][1] } : { kind: key.toLowerCase().includes('color') ? 'color' : 'text' }) }
      if (['image', 'panel'].includes(String(object.type))) fields.src = { kind: 'media', value: '(existing media)' }
      if (['image', 'button'].includes(String(object.type))) fields.url = { kind: 'link', value: object.url ?? '' }
      fields.anchorName = { kind: 'anchor', value: object.anchorName ?? '' }
      targets.push({ id: 'object:' + block.id + ':' + section + ':' + object.id, kind: 'object', blockId: block.id, section, objectId: object.id, parentId: typeof object.parentId === 'string' ? object.parentId : undefined, label: 'Section ' + section + ' ' + object.type + ': ' + String(block.props['sectionObject_' + object.id] || object.text || object.alt || '').slice(0, 60), fields, ...(object.type === 'collage' ? { collections: itemFields.collage } : {}) })
      if (object.type === 'collage' && Array.isArray(object.images)) object.images.forEach((photo, imageIndex) => { if (record(photo)) targets.push({ id: 'item:' + block.id + ':' + object.id + ':' + String(photo.id || imageIndex), kind: 'item', blockId: block.id, objectId: String(object.id), itemPath: ['section' + section + 'Objects', (block.props['section' + section + 'Objects'] as Value[]).indexOf(object), 'images', imageIndex], label: 'Collage photo #' + (imageIndex + 1) + ': ' + String(photo.alt || photo.caption || ''), fields: fieldsForItem(photo, itemFields.collage.images) }) })
    }
  }
  return targets
}

/** Resolve only explicit edit subjects; quoted replacement text and link destinations are not subjects. */
export function resolveEditTarget(config: SiteConfig, scope: EditScope, instruction: string): { scope: EditScope; explicit: boolean; label?: string; conflict?: string; candidates?: { id: string; label: string }[]; backgroundRequested?: boolean; backgroundOnly?: boolean } {
  const page = config.pages?.find(item => item.id === scope.pageId)
  if (!page) return { scope, explicit: false, conflict: 'The selected page no longer exists. Choose a page with Change selection.' }
  const targets = editTargets(config, scope.pageId), selected = targets.find(item => item.id === scope.target)
  if (!selected) return { scope, explicit: false, conflict: 'The selected component no longer exists. Use Change selection.' }
  const unchanged = { scope, explicit: false, label: selected.label }
  const command = instruction.trim().match(/^(?:(?:please|can you|could you|would you|i (?:want|would like) you to)\s+)*(change|set|make|update|edit|recolou?r|style|resize|move|remove|delete|hide|show)\s+([\s\S]+)$/i)
  if (!command) return unchanged
  // The destination/replacement clause may contain component names that are only new wording.
  const subjectWords = command[2].replace(/["“‘'`][^"”’'`]*["”’'`]/g, value => ' '.repeat(value.length))
  const subjectEnd = subjectWords.search(/\b(?:to|with|into|using|as|by|so that|then|do not|don't|never|keep|leave)\b/i)
  const subject = command[2].slice(0, subjectEnd < 0 ? undefined : subjectEnd)
  const quotedName = subject.match(/\b(?:section|block|hero|banner)\s+(?:(?:called|titled|named|headed)\s+)?["“‘'`]([^"”’'`]+)["”’'`]|["“‘'`]([^"”’'`]+)["”’'`]\s+(?:section|block|hero|banner)\b/i)
  const unquoted = subject.replace(/["“‘'`][^"”’'`]*["”’'`]/g, ' ').toLowerCase()
  const normal = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
  const formalName = !quotedName ? unquoted.match(/\b(?:section|block|hero|banner)\s+(?:called|titled|named|headed)\s+(.+?)(?=\s+(?:background|fill|colou?r|text|font|width|height|size|position)\b|$)/i)?.[1] : ''
  const name = quotedName ? normal(quotedName[1] || quotedName[2]) : formalName ? normal(formalName) : ''
  const blockTargets = targets.filter(item => item.kind === 'block')
  let matches: EditTarget[] = [], reference = '', explicit = false
  if (name) {
    explicit = true; reference = 'section titled “' + (quotedName ? quotedName[1] || quotedName[2] : formalName) + '”'
    matches = blockTargets.filter(item => {
      const props = page.blocks.find(block => block.id === item.blockId)!.props
      return [props.title, props.headline, props.logo, typeof props.body === 'string' ? props.body.match(/^#{1,6}\s+(.+)$/m)?.[1] : undefined].some(value => typeof value === 'string' && normal(value) === name)
    })
  } else {
    const deictic = unquoted.match(/^\s*(?:(?:the )?(?:selected|current)|this|that)\s+(panel|text|image|button|collage)\b/i)
    if (deictic && selected.kind === 'object') {
      const objects = page.blocks.find(block => block.id === selected.blockId)?.props['section' + selected.section + 'Objects']
      if (Array.isArray(objects) && objects.some(object => record(object) && object.id === selected.objectId && object.type === deictic[1].toLowerCase())) return unchanged
    }
    const subjectStart = normal(unquoted).replace(/^the\s+/, '')
    const namedTargets = blockTargets.map(item => {
      const props = page.blocks.find(block => block.id === item.blockId)!.props
      const names = [props.title, props.headline, typeof props.body === 'string' ? props.body.match(/^#{1,6}\s+(.+)$/m)?.[1] : undefined].filter((value): value is string => typeof value === 'string' && normal(value).length >= 3)
      const length = Math.max(0, ...names.filter(value => subjectStart === normal(value) || subjectStart.startsWith(normal(value) + ' ') || (' ' + subjectStart + ' ').includes(' ' + normal(value) + ' section ') || (' ' + subjectStart + ' ').includes(' ' + normal(value) + ' block ')).map(value => normal(value).length))
      return { item, length }
    })
    const longestName = Math.max(0, ...namedTargets.map(item => item.length))
    const titleMatches = namedTargets.filter(item => item.length > 0 && item.length === longestName).map(item => item.item)
    const aliases: [RegExp, string[]][] = [
      [/\bhero\b/i, ['hero']], [/\bbanner\b/i, ['hero', 'banner']], [/\bfooter\b/i, ['footer']],
      [/\b(?:navbar|nav bar|navigation bar|navigation menu)\b/i, ['navbar']],
      [/\b(?:staff directory|team(?: section)?)\b/i, ['team']], [/\b(?:photo gallery|gallery)\b/i, ['gallery']],
      [/\b(?:photo collage|collage)\b/i, ['collage']], [/\b(?:contact form|contact section)\b/i, ['contact']],
      [/\bcalendar\b/i, ['calendar']], [/\b(?:content section|content block)\b/i, ['content']],
      [/\bpanel\b/i, ['panel']], [/\bfeatures\b/i, ['features']], [/\bpricing\b/i, ['pricing']],
      [/\btestimonials\b/i, ['testimonials']], [/\b(?:statistics|stats)\b/i, ['stats']],
      [/\b(?:faq|frequently asked questions)\b/i, ['faq']], [/\b(?:cta|call to action)\b/i, ['cta']],
      [/\bnewsletter\b/i, ['newsletter']], [/\blogo cloud\b/i, ['logocloud']], [/\bdivider\b/i, ['divider']],
      [/\bimage(?: block)?\b/i, ['image']], [/\bvideo\b/i, ['video', 'mediaVideo']], [/\baudio\b/i, ['audio']],
      [/\bdocument library\b/i, ['documentLibrary']], [/\bpdf(?: viewer)?\b/i, ['pdfViewer']],
      [/\bdocument block\b/i, ['document']],
    ]
    const types = aliases.filter(([pattern]) => pattern.test(unquoted)).sort(([left], [right]) => left.exec(unquoted)!.index - right.exec(unquoted)!.index)
    const owner = types.find(([pattern]) => /\b(?:in|inside|within|of)\s+(?:(?:the|this|that|selected|current)\s+)?$/i.test(unquoted.slice(0, pattern.exec(unquoted)!.index)))
    if (owner) types.sort((left, right) => left === owner ? -1 : right === owner ? 1 : 0)
    // Several named edit subjects require whole-page scope, not an arbitrary first match.
    if (!titleMatches.length && types.length > 1 && types.some(([pattern, values]) => !values.some(value => types[0][1].includes(value)) && /\band\b|\bplus\b|[,;]/i.test(unquoted.slice(types[0][0].exec(unquoted)!.index, pattern.exec(unquoted)!.index)))) {
      return selected.kind === 'page' ? unchanged : { ...unchanged, conflict: 'This request names several components. Choose the whole page with Change selection, or request one component at a time.', candidates: [{ id: 'page:' + page.id, label: page.name + ' — whole page' }] }
    }
    if (titleMatches.length) { explicit = true; reference = 'named section'; matches = titleMatches }
    else if (types.length) {
      explicit = true; reference = types[0][0].exec(unquoted)![0]
      const allowedTypes = types.filter(([, values]) => values.some(value => types[0][1].includes(value))).reduce((result, [, values]) => result.filter(value => values.includes(value)), types[0][1])
      matches = blockTargets.filter(item => allowedTypes.includes(page.blocks.find(block => block.id === item.blockId)!.type))
    } else {
      // Unquoted names must explicitly describe a section/block, never an arbitrary body phrase.
      if (/\b(?:section|block)\b/i.test(unquoted)) {
        matches = blockTargets.filter(item => {
          const props = page.blocks.find(block => block.id === item.blockId)!.props
          return [props.title, props.headline, typeof props.body === 'string' ? props.body.match(/^#{1,6}\s+(.+)$/m)?.[1] : undefined].some(value => typeof value === 'string' && normal(value).length >= 3 && (' ' + normal(unquoted) + ' ').includes(' ' + normal(value) + ' '))
        })
        if (matches.length) { explicit = true; reference = 'named section' }
        else {
          const unknownName = normal(unquoted.match(/^\s*(?:the\s+)?(.+?)\s+(?:section|block)\b/i)?.[1] ?? '')
          if (unknownName && !/^(?:this|that|current|selected|chosen|first|second|third|fourth|last|top|bottom|text|background|fill|colou?r|width|height|spacing)\b/i.test(unknownName) && !/\b(?:in|on|of|for|within|inside)\b/i.test(unknownName)) { explicit = true; reference = 'section named “' + unknownName + '”' }
        }
      }
    }
    const ordinal = unquoted.match(/\b(first|second|third|fourth|last|top|bottom)\s+(?:(?:hero|banner|footer|content)\s+)?(?:section|block)\b|\b(first|last|top|bottom)\s+(?:hero|banner|footer)\b|\b(?:section|block)\s*(?:number\s*|#\s*)?(\d+)\b/i)
    if (ordinal) {
      explicit = true; reference = ordinal[0]
      const ordered = matches.length || types.length ? matches : blockTargets
      const position = ordinal[1] || ordinal[2], index = position === 'last' || position === 'bottom' ? ordered.length - 1 : ordinal[3] ? Number(ordinal[3]) - 1 : ['first', 'second', 'third', 'fourth'].indexOf(position === 'top' ? 'first' : position)
      matches = ordered[index] ? [ordered[index]] : []
    }
  }
  if (!explicit) return unchanged
  const candidates = matches.map(({ id, label }) => ({ id, label }))
  if (!matches.length) return { ...unchanged, explicit: true, conflict: 'No matching ' + reference + ' exists on this page. Use Change selection or name an existing component.', candidates }
  if (matches.length > 1) {
    const sameBlock = matches.find(item => item.id === selected.id)
    if (sameBlock) matches = [sameBlock]
    else return { ...unchanged, explicit: true, conflict: 'More than one ' + reference + ' matches. Choose the intended component before Preview.', candidates }
  }
  const target = matches[0]
  const targetProps = page.blocks.find(block => block.id === target.blockId)!.props, colorWords = normal(subjectWords)
  const colorReference = name || [targetProps.title, targetProps.headline].find(value => typeof value === 'string' && normal(value).length >= 3 && colorWords.includes(normal(value))) || reference
  const colorReferenceEnd = colorWords.indexOf(normal(String(colorReference)))
  const colorValue = colorReferenceEnd < 0 ? colorWords : colorWords.slice(colorReferenceEnd + normal(String(colorReference)).length)
  const backgroundRequested = /\b(?:background|fill)\b/i.test(unquoted) && !/\b(?:text|font|heading|headline|title|subtitle|subheading|link|button|icon)\s+(?:background|fill)\b/i.test(unquoted) || /\bcolou?r\b/i.test(unquoted) && !/\b(?:text|font|heading|headline|title|subtitle|subheading|link|button|outline|border|icon)\b/i.test(unquoted)
  const backgroundOnly = (/\b(?:background|fill|colou?r)\b/i.test(unquoted) || /^(?:change|set|make|recolou?r|style)$/i.test(command[1]) && /\b(?:yellow|red|blue|green|orange|purple|violet|pink|brown|black|white|gr[ae]y|gold|silver|beige|navy|teal)\b|#[\da-f]{6}\b/i.test(colorValue)) && !/\b(?:text|font|heading|headline|title|subtitle|subheading|link|button|outline|border|icon|width|height|size|position|bigger|smaller|wider|narrower|taller|shorter)\b/i.test(unquoted) && !/\band\b/i.test(subjectWords.replace(/\band (?:leave|keep) (?:everything|the rest)[\s\S]*$/i, ''))
  return { scope: { ...scope, target: target.id }, explicit: true, label: target.label, backgroundRequested: backgroundRequested || backgroundOnly, backgroundOnly,
    ...(selected.kind !== 'page' && selected.id !== target.id ? { conflict: 'Your request names ' + target.label + ', but Editing currently selects ' + selected.label + '. Choose the requested component before Preview.', candidates: [{ id: target.id, label: target.label }] } : {}) }
}

export function editContext(config: SiteConfig, scope: EditScope, media: readonly EditMedia[] = []) {
  const targets = editTargets(config, scope.pageId), selected = targets.find(target => target.id === scope.target)
  if (!selected) throw new Error('Choose an existing component or the whole page.')
  const included = selected.kind === 'page' ? targets : targets.filter(target => target.id === selected.id || target.parentId === selected.id || selected.kind === 'block' && target.blockId === selected.blockId || selected.kind === 'object' && target.blockId === selected.blockId && (target.parentId === selected.objectId || target.kind === 'item' && target.objectId === selected.objectId))
  if (included.length > 400) throw new Error('This page is large. Select one block or component instead.')
  const context = { pageId: scope.pageId, target: selected.id, targets: included, pages: config.pages?.map(item => ({ name: item.name, path: item.path })), media: media.slice(0, 500).map(({ id, name, mime, folder, width, height }) => ({ id, name, mime, folder, width, height })), instructions: 'Only these target ids may be changed. set changes one listed scalar field, never a media field. setMedia uses a catalog asset id as value and a listed media/link field. addItem targets a listed collection on a block, collage or Navbar parent; value contains supported fields (assetId instead of a src/image/avatar path). Navbar navItems can include children arrays of label/url objects. linkText value is {text: exact unique phrase, url: destination} or {text, assetId}; preserve other text and formatting. set anchorName creates/renames a unique jump destination. Internal links must use existing page paths and anchors. move reorders a block/item using a zero-based index, or adjusts object x/y/width/height. textStyle formats a text field using JSON style values; optional text limits formatting to that unique phrase. addObject adds text, image, button, panel or collage to a block or panel. addBlock adds an ordinary block to the whole page. remove deletes the exact target. value must be a JSON-encoded value, not code.' }
  if (JSON.stringify(context).length > 120000) throw new Error('Choose a smaller component; this page contains too much text for one request.')
  return context
}

function parseValue(operation: EditOperation): unknown {
  if (!text(operation.value, 50000)) throw new Error('An edit contains oversized or invalid data.')
  try { return JSON.parse(operation.value) } catch {
    // Scalar fields still pass their exact type and allowed-value checks below.
    if (operation.action === 'set' || operation.action === 'setMedia') return operation.value
    throw new Error('An edit has an invalid JSON value.')
  }
}
function updateText(props: Value, field: string, value: string) {
  props[field] = value
  const old = props[field + 'Rich']
  if (Array.isArray(old)) {
    const style = old.find(record) ?? {}
    props[field + 'Rich'] = value.split('\n').map((line, index) => ({ ...style, text: line, line: index + 1 }))
  }
}
function formatText(props: Value, field: string, value: unknown, linking = false) {
  if (!record(value) || Object.keys(value).some(key => key !== 'text' && !(linking && key === 'href') && !styleKeys.has(key))) throw new Error('Unsupported text formatting.')
  const { text: phrase, ...style } = value
  for (const [key, setting] of Object.entries(style)) {
    if (key === 'font' && (typeof setting !== 'string' || !/^[\p{L}\p{N} .,_-]{1,100}$/u.test(setting)) || key === 'color' && !hex(setting) || ['bold', 'italic', 'underline'].includes(key) && typeof setting !== 'boolean' || key === 'align' && !['left', 'center', 'right', 'justify'].includes(String(setting)) || key === 'size' && !bounded(setting, 6, 200) || key === 'lineHeight' && !bounded(setting, .8, 4) || ['spaceBefore', 'spaceAfter', 'indentLeft', 'indentRight', 'firstLineIndent'].includes(key) && !bounded(setting, -100, 500)) throw new Error('Invalid font, color or paragraph setting.')
  }
  const old = props[field + 'Rich']
  let runs: Value[]
  if (Array.isArray(old) && old.every(run => record(run) && typeof run.text === 'string')) runs = old as Value[]
  else if (field === 'body' || /^section[2-4]Text$/.test(field)) {
    runs = []; let line = 0
    const collect = (node: ReactNode, style: Value) => {
      if (typeof node === 'string' || typeof node === 'number') { runs.push({ ...style, text: String(node) }); return }
      if (Array.isArray(node)) { node.forEach(child => collect(child, style)); return }
      if (!isValidElement<{ children?: ReactNode; href?: string }>(node)) return
      const tag = String(node.type), next = { ...style, ...(['h2', 'h3', 'p', 'li'].includes(tag) ? { tag, line: ++line } : {}), ...(tag === 'strong' ? { bold: true } : {}), ...(tag === 'em' ? { italic: true } : {}), ...(tag === 'a' ? { href: node.props.href } : {}) }
      collect(node.props.children, next)
    }
    renderMarkdown(String(props[field] ?? '')).forEach(node => collect(node, {}))
  } else runs = String(props[field] ?? '').split('\n').map((line, index) => ({ text: line, line: index + 1, tag: 'p' }))
  const joined = runs.map(run => String(run.text)).join('')
  const start = phrase === undefined ? 0 : typeof phrase === 'string' && phrase && joined.indexOf(phrase)
  if (typeof start !== 'number' || start < 0 || phrase && joined.indexOf(String(phrase), start + 1) >= 0) throw new Error('The text phrase must match exactly once in this text box.')
  const end = phrase === undefined ? joined.length : start + String(phrase).length
  let offset = 0
  props[field + 'Rich'] = runs.flatMap(run => {
    const wording = String(run.text), left = Math.max(0, start - offset), right = Math.min(wording.length, end - offset); offset += wording.length
    if (right <= left) return [run]
    return [...(left ? [{ ...run, text: wording.slice(0, left) }] : []), { ...run, ...style, text: wording.slice(left, right) }, ...(right < wording.length ? [{ ...run, text: wording.slice(right) }] : [])]
  })
}

/** Evaluate the entire proposal on a clone, then accept it as one undoable change. */
export function previewEdits(config: SiteConfig, scope: EditScope, input: unknown, media: readonly EditMedia[] = [], instruction?: string): EditPreview {
  const resolved = resolveEditTarget(config, scope, instruction ?? '')
  if (resolved.conflict) throw new Error(resolved.conflict)
  scope = resolved.scope
  if (!record(input) || Object.keys(input).some(key => !['summary', 'operations'].includes(key)) || !text(input.summary, 1500) || !Array.isArray(input.operations) || input.operations.length < 1 || input.operations.length > 50 || JSON.stringify(input).length > 150000) throw new Error('The assistant returned an invalid edit proposal.')
  const before = JSON.stringify(config), candidate = structuredClone(config), context = editContext(config, scope, media)
  const page = candidate.pages!.find(item => item.id === scope.pageId)!, changes: string[] = [], sharedChanges = new Set<string>()
  const newLinks: string[] = [], anchorRenames: { old: string; next: string }[] = [], pageRenames: { old: string; next: string }[] = []
  const itemLocations = new Map<string, { item: Value; array: unknown[] }>()
  for (const target of context.targets) if (target.itemPath) {
    let owner: unknown = page.blocks.find(block => block.id === target.blockId)!.props
    for (const key of target.itemPath.slice(0, -1)) owner = (owner as Value)[key]
    const array = owner as unknown[], item = array[target.itemPath.at(-1) as number]
    if (record(item)) itemLocations.set(target.id, { item, array })
  }
  for (const raw of input.operations) {
    if (!record(raw) || Object.keys(raw).some(key => !['action', 'target', 'field', 'value'].includes(key)) || !text(raw.action, 30) || !text(raw.target, 250) || !text(raw.field, 120)) throw new Error('Unsupported edit operation.')
    const operation = raw as unknown as EditOperation, target = context.targets.find(item => item.id === operation.target)
    if (!target) throw new Error('The proposal attempts to change a component outside the selected scope.')
    if (resolved.backgroundOnly && (operation.action !== 'set' || operation.target !== scope.target || operation.field !== 'blockBackgroundColor')) throw new Error('This request changes only the named section’s background. The proposal changed a different property or child component.')
    const block = page.blocks.find(item => item.id === target.blockId)
    const objects = block && target.section ? block.props['section' + target.section + 'Objects'] as Value[] : undefined
    const object = objects?.find(item => item.id === target.objectId)
    const location = itemLocations.get(target.id), item = location?.item
    if (target.kind !== 'page' && !block || target.kind === 'object' && !object) throw new Error('A target was removed earlier in this proposal.')
    if (target.kind === 'item' && (!item || !location!.array.includes(item))) throw new Error('This item was already removed.')
    const value = parseValue(operation)
    if (operation.action === 'set') {
      if (!Object.hasOwn(target.fields, operation.field) || forbidden.test(operation.field)) throw new Error('This property cannot be changed by AI.')
      const field = operation.field, definition = target.fields[field] as Value
      if (definition.kind === 'media') throw new Error('Use setMedia with an approved asset id.')
      if (target.kind === 'page') {
        if (field === 'name' && text(value, 120) && value.trim()) page.name = value.trim()
        else if (field === 'path' && typeof value === 'string' && /^\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(value) && value.length <= 180 && page.path !== '/' && !candidate.pages!.some(other => other.id !== page.id && other.path.toLowerCase() === value.toLowerCase())) { pageRenames.push({ old: page.path, next: value }); page.path = value }
        else throw new Error('Use a unique page name/address. Changing the Home address is a manual action.')
      } else if (definition.kind === 'anchor') {
        if (!text(value, 64) || value && (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value) || value === 'main-content')) throw new Error('Use a unique anchor beginning with a letter.')
        const owner = object ?? block!.props
        const old = typeof owner.anchorName === 'string' ? owner.anchorName : ''
        owner.anchorName = value
        if (old !== value) anchorRenames.push({ old, next: value })
      } else if (definition.kind === 'link') {
        const url = destination(candidate, page.id, value, media)
        const owner = item ?? object ?? block!.props
        owner[field] = url; newLinks.push(url)
      } else if (target.kind === 'item') {
        if (definition.kind === 'number' ? !bounded(value, 0, 10000) : definition.kind === 'checkbox' ? typeof value !== 'boolean' : definition.kind === 'strings' ? !Array.isArray(value) || value.length > 50 || value.some(line => !text(line, 1000)) : !text(value, 12000)) throw new Error('Invalid item property.')
        if (field === 'date' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) || field === 'time' && value !== '' && (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) throw new Error('Use a real date and a valid 24-hour time.')
        item![field] = value
      } else if (target.kind === 'object') {
        if (!objectFields.has(field) || (objectBounds[field] ? !bounded(value, ...objectBounds[field]) : ['color', 'backgroundColor', 'textColor', 'borderColor'].includes(field) ? !hex(value) : !text(value))) throw new Error('Invalid component property value.')
        const delta = ['x', 'y'].includes(field) ? Number(value) - Number(object![field] || 0) : 0
        if (field === 'text') { object!.text = value; updateText(block!.props, 'sectionObject_' + target.objectId, String(value)) } else object![field] = value
        if (delta) for (const child of objects!.filter(item => item.parentId === object!.id)) child[field] = Number(child[field] || 0) + delta
        if (['text', 'panel'].includes(String(object!.type)) && ['fontSize', 'textColor'].includes(field)) {
          const textField = 'sectionObject_' + target.objectId
          if (block!.props[textField] === undefined) block!.props[textField] = object!.text || ''
          formatText(block!.props, textField, field === 'fontSize' ? { size: value } : { color: value })
        }
      } else {
        if (geometry[field] ? !bounded(value, ...geometry[field]) : definition.kind === 'color' ? !hex(value) : definition.kind === 'checkbox' ? typeof value !== 'boolean' : definition.kind === 'strings' ? !Array.isArray(value) || value.length > 100 || value.some(item => !text(item, 1000)) : Array.isArray(definition.options) ? !definition.options.includes(value) : !text(value)) throw new Error('Invalid property value.')
        if (field === 'variant') block!.variant = String(value)
        else if (typeof value === 'string' && !colors.has(field) && !field.endsWith('Align')) updateText(block!.props, field, value)
        else block!.props[field] = value
        if (field === 'textColor') for (const [key, runs] of Object.entries(block!.props)) if (key.endsWith('Rich') && Array.isArray(runs)) block!.props[key] = runs.map(run => record(run) ? { ...run, color: value } : run)
      }
    } else if (operation.action === 'setMedia') {
      const definition = target.fields[operation.field]
      if (!record(definition) || !['media', 'link'].includes(String(definition.kind))) throw new Error('Select a media or link field.')
      const asset = mediaFor(media, value, operation.field, block!, definition.kind === 'link' || target.itemPath?.[0] === 'placedMedia')
      const destination = item ?? object ?? block!.props
      destination[operation.field] = asset.path
      if (definition.kind === 'link') newLinks.push(asset.path)
      if (operation.field === 'src') destination.assetId = asset.id
      if (target.itemPath?.[0] === 'placedMedia') { destination.mime = asset.mime; destination.name = asset.name }
      if (target.kind === 'item' && block!.type === 'gallery' && !item!.id) item!.id = crypto.randomUUID()
    } else if (operation.action === 'addItem') {
      if (!['block', 'object', 'item'].includes(target.kind) || !target.collections || !Object.hasOwn(target.collections, operation.field) || !record(value)) throw new Error('Choose a supported collection on a block, collage or Navbar parent.')
      const fields = target.collections[operation.field], added: Value = { id: crypto.randomUUID() }
      for (const [key, setting] of Object.entries(value)) {
        if (key === 'assetId') continue
        if (key === 'url' && fields.includes(key)) { added.url = destination(candidate, page.id, setting, media); newLinks.push(String(added.url)); continue }
        if (key === 'children' && block!.type === 'navbar' && target.kind === 'block' && operation.field === 'navItems') {
          if (!Array.isArray(setting) || setting.length > 30 || setting.some(child => !record(child) || Object.keys(child).some(field => !['label', 'url'].includes(field)) || !text(child.label, 120) || !child.label.trim())) throw new Error('A submenu needs labeled destinations.')
          added.children = setting.map(child => ({ id: crypto.randomUUID(), label: child.label, url: destination(candidate, page.id, child.url, media) }))
          newLinks.push(...(added.children as Value[]).map(child => String(child.url))); continue
        }
        if (!fields.includes(key) || mediaFields.has(key) || forbidden.test(key) || (key === 'featured' ? typeof setting !== 'boolean' : ['features', 'links'].includes(key) ? !Array.isArray(setting) || setting.some(line => !text(line, 1000)) : ['x', 'y', 'width', 'height', 'layer'].includes(key) ? !bounded(setting, 0, 10000) : !text(setting, 12000))) throw new Error('Unsupported item content.')
        added[key] = setting
      }
      const mediaField = fields.find(key => mediaFields.has(key))
      if (value.assetId !== undefined) { if (!mediaField) throw new Error('This item has no media field.'); const asset = mediaFor(media, value.assetId, mediaField, block!, operation.field === 'placedMedia'); added[mediaField] = asset.path; if (mediaField === 'src') added.assetId = asset.id; if (operation.field === 'placedMedia') { added.mime = asset.mime; added.name ||= asset.name } }
      if (operation.field === 'events' && (typeof added.title !== 'string' || !added.title.trim() || typeof added.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(added.date) || !Number.isFinite(Date.parse(added.date)) || new Date(added.date).toISOString().slice(0, 10) !== added.date || added.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(added.time)))) throw new Error('An event requires a title, real date and valid time.')
      if (['navItems', 'children', 'resourceButtons'].includes(operation.field) && (typeof added.label !== 'string' || !added.label.trim() || typeof added.url !== 'string' || !added.url)) throw new Error('A navigation link needs both a label and a destination.')
      const owner = item ?? object ?? block!.props
      const list = Array.isArray(owner[operation.field]) ? owner[operation.field] as unknown[] : []
      if (list.length >= 500) throw new Error('This collection is full.')
      list.push(added); owner[operation.field] = list
    } else if (operation.action === 'linkText') {
      if (!record(value) || Object.keys(value).some(key => !['text', 'url', 'assetId'].includes(key)) || typeof value.text !== 'string' || !value.text) throw new Error('Choose the exact text phrase and its destination.')
      const field = target.kind === 'object' && ['text', 'panel'].includes(String(object!.type)) ? 'sectionObject_' + target.objectId : operation.field
      if (target.kind === 'page' || target.kind === 'item' || target.kind === 'block' && (!Object.hasOwn(target.fields, field) || !['text', 'textarea'].includes(String((target.fields[field] as Value).kind))) || target.kind === 'object' && !['text', 'panel'].includes(String(object!.type))) throw new Error('Select a text field for an inline link.')
      if (target.kind === 'object' && block!.props[field] === undefined) block!.props[field] = object!.text || ''
      const url = value.assetId ? mediaFor(media, value.assetId, 'url', block!, true).path : destination(candidate, page.id, value.url, media)
      formatText(block!.props, field, { text: value.text, href: url, underline: !!url }, true); newLinks.push(url)
    } else if (operation.action === 'textStyle') {
      const field = target.kind === 'object' && object!.type === 'text' ? 'sectionObject_' + target.objectId : operation.field
      if (target.kind === 'page' || target.kind === 'item' || target.kind === 'object' && object!.type !== 'text' || target.kind === 'block' && (!Object.hasOwn(target.fields, field) || !['text', 'textarea'].includes(String((target.fields[field] as Value).kind)))) throw new Error('Select a text field to format.')
      if (target.kind === 'object' && block!.props[field] === undefined) block!.props[field] = object!.text || ''
      formatText(block!.props, field, value)
    } else if (operation.action === 'move') {
      if (!record(value)) throw new Error('Invalid move.')
      if (target.kind === 'item') {
        if (Object.keys(value).some(key => key !== 'index') || !Number.isInteger(value.index) || !bounded(value.index, 0, location!.array.length - 1)) throw new Error('Choose an existing item position.')
        if (context.target === target.id && !item!.id) throw new Error('Select the parent block to reorder this legacy item.')
        location!.array.splice(location!.array.indexOf(item!), 1); location!.array.splice(value.index, 0, item!)
      } else if (target.kind === 'block') {
        if (Object.keys(value).some(key => key !== 'index') || !Number.isInteger(value.index) || !bounded(value.index, 0, page.blocks.length - 1)) throw new Error('Choose an existing block position.')
        const index = page.blocks.indexOf(block!); page.blocks.splice(index, 1); page.blocks.splice(value.index, 0, block!)
      } else if (target.kind === 'object') {
        if (Object.keys(value).some(key => !['x', 'y', 'width', 'height'].includes(key)) || Object.entries(value).some(([key, setting]) => !bounded(setting, ...objectBounds[key]))) throw new Error('Invalid object position or size.')
        const dx = Number(value.x ?? object!.x) - Number(object!.x), dy = Number(value.y ?? object!.y) - Number(object!.y)
        Object.assign(object!, value)
        for (const child of objects!.filter(item => item.parentId === object!.id)) { child.x = Number(child.x) + dx; child.y = Number(child.y) + dy }
      } else throw new Error('Select a component to move.')
    } else if (operation.action === 'remove') {
      if (target.kind === 'page') throw new Error('Deleting a whole page is a manual action.')
      if (target.kind === 'item') location!.array.splice(location!.array.indexOf(item!), 1)
      else if (target.kind === 'block') page.blocks.splice(page.blocks.indexOf(block!), 1)
      else {
        const removed = objects!.filter(item => item.id === object!.id || item.parentId === object!.id)
        block!.props['section' + target.section + 'Objects'] = objects!.filter(item => !removed.includes(item))
        for (const item of removed) { delete block!.props['sectionObject_' + item.id]; delete block!.props['sectionObject_' + item.id + 'Rich'] }
      }
    } else if (operation.action === 'addObject') {
      if (!record(value) || !['text', 'image', 'button', 'panel', 'collage'].includes(String(value.type)) || Object.keys(value).some(key => key !== 'type' && !objectFields.has(key))) throw new Error('Invalid new object.')
      if (target.kind !== 'block' && !(target.kind === 'object' && object!.type === 'panel')) throw new Error('Select a block or panel to add an object.')
      for (const [field, setting] of Object.entries(value)) if (field !== 'type' && (objectBounds[field] ? !bounded(setting, ...objectBounds[field]) : ['color', 'backgroundColor', 'textColor', 'borderColor'].includes(field) ? !hex(setting) : !text(setting))) throw new Error('Invalid new component property.')
      const section = target.section || 1, key = 'section' + section + 'Objects', saved = Array.isArray(block!.props[key]) ? block!.props[key] as Value[] : []
      saved.push({ id: crypto.randomUUID(), text: '', x: object ? Number(object.x) + 1 : 5, y: object ? Number(object.y) + 20 : 30, width: object ? Math.max(1, Number(object.width) - 2) : 30, height: 80, layer: Math.max(0, ...saved.map(item => Number(item.layer) || 0)) + 1, ...value, ...(object ? { parentId: object.id } : {}) })
      block!.props[key] = saved
    } else if (operation.action === 'addBlock') {
      if (target.kind !== 'page' || !record(value) || Object.keys(value).some(key => !['type', 'variant'].includes(key))) throw new Error('Choose the whole page to add a block.')
      const metadata = blockMetadata.find(item => item.type === value.type)
      if (!metadata || typeof value.variant !== 'string' || !metadata.variants.includes(value.variant)) throw new Error('Unsupported block type or variant.')
      const footer = page.blocks.findIndex(item => item.type === 'footer')
      page.blocks.splice(footer < 0 ? page.blocks.length : footer, 0, { id: crypto.randomUUID(), type: metadata.type, variant: value.variant, props: structuredClone(metadata.defaultProps) })
    } else throw new Error('Unsupported edit action.')
    if (block?.webstudioSharedSectionId && !(target.kind === 'block' && ['remove', 'move'].includes(operation.action))) sharedChanges.add(block.id)
    const labels: Record<string, string> = { layoutWidth: 'width (%)', layoutHeight: 'height (px)', layoutLeft: 'left (%)', layoutTop: 'top (px)', layoutLayer: 'layer order', blockBackgroundColor: 'background color', textColor: 'text color', src: 'media', anchorName: 'anchor name' }
    const fieldLabel = String((target.fields[operation.field] as Value | undefined)?.label || labels[operation.field] || operation.field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase())
    const actions: Record<string, string> = { textStyle: 'Format text in', addObject: 'Add a component to', addBlock: 'Add a block to', move: 'Move', remove: 'Remove', addItem: 'Add an item to', linkText: 'Link text in' }
    changes.push(operation.action === 'set' ? 'Change ' + fieldLabel + ' on ' + target.label + ' to ' + String(value).slice(0, 120) : operation.action === 'setMedia' ? 'Use ' + (media.find(asset => asset.id === value)?.name || 'approved media') + ' in ' + target.label : actions[operation.action] + ' ' + target.label)
  }
  if (resolved.backgroundRequested && !input.operations.some(operation => record(operation) && operation.action === 'set' && operation.target === scope.target && operation.field === 'blockBackgroundColor')) throw new Error('The proposal did not change the named section’s background. A child component cannot substitute for that section.')
  for (const blockId of sharedChanges) {
    const block = page.blocks.find(item => item.id === blockId)!
    for (const other of candidate.pages!) for (const copy of other.blocks) if (copy.id !== block.id && copy.webstudioSharedSectionId === block.webstudioSharedSectionId) { copy.props = structuredClone(block.props); copy.variant = block.variant; changes.push('Update shared copy on ' + other.name) }
  }
  if (anchorRenames.some(change => change.next)) {
    for (const owner of candidate.pages!) {
      const names = owner.blocks.flatMap(block => [block.props.anchorName, ...[1, 2, 3, 4].flatMap(section => Array.isArray(block.props['section' + section + 'Objects']) ? (block.props['section' + section + 'Objects'] as Value[]).map(object => object.anchorName) : [])]).filter(name => typeof name === 'string' && name)
      for (const change of anchorRenames) if (change.next && names.filter(name => name === change.next).length > 1) throw new Error('That anchor name is already used on ' + owner.name + '.')
    }
  }
  for (const owner of candidate.pages!) for (const block of owner.blocks) visitBlockLinks(block, url => {
    let updated = url
    for (const change of pageRenames) if (updated.startsWith('/') && pageLinkPath(updated) === change.old) updated = change.next + updated.slice(change.old.length)
    for (const change of anchorRenames) if (change.old && (owner.id === page.id && updated === '#' + change.old || updated === page.path + '#' + change.old)) {
      if (!change.next) throw new Error('This anchor is still linked. Update its links before removing the destination.')
      updated = updated.slice(0, updated.indexOf('#') + 1) + change.next
    }
    if (updated !== url) { changes.push('Update incoming link on ' + owner.name + ': ' + url + ' → ' + updated); newLinks.push(updated); return updated }
    if (newLinks.includes(url)) destination(candidate, owner.id, url, media, true)
  })
  candidate.blocks = candidate.pages!.find(item => item.path === '/')!.blocks
  validateProjectConfig(candidate)
  const affectedPages = candidate.pages!.filter(item => JSON.stringify(item) !== JSON.stringify(config.pages!.find(old => old.id === item.id))).map(item => item.id)
  if (!affectedPages.length) throw new Error('This proposal makes no changes.')
  return { before, after: JSON.stringify(candidate), config: candidate, changes, affectedPages }
}

export function acceptEdits(current: SiteConfig, preview: EditPreview): SiteConfig {
  if (JSON.stringify(current) !== preview.before || JSON.stringify(preview.config) !== preview.after) throw new Error('The project or proposal changed. Generate a fresh preview.')
  validateProjectConfig(preview.config)
  return structuredClone(preview.config)
}

export function refineEdits(current: SiteConfig, scope: EditScope, previous: EditPreview | null, plan: unknown, media: readonly EditMedia[] = [], instruction?: string): EditPreview {
  if (previous && JSON.stringify(current) !== previous.before) throw new Error('The project changed. Discard the old preview and request a new one.')
  const next = previewEdits(previous?.config ?? current, scope, plan, media, instruction)
  return previous ? { ...next, before: previous.before, changes: [...previous.changes, ...next.changes], affectedPages: [...new Set([...previous.affectedPages, ...next.affectedPages])] } : next
}
