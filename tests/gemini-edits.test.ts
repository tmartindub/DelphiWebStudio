import { describe, it, expect } from 'vitest'
import { editContext, editTargets, previewEdits, acceptEdits, refineEdits, type EditOperation } from '@/ai/gemini-edits'
import type { SiteConfig } from '@/blocks/types'
import { useConfigStore } from '@/store/configStore'
import { createProjectFile, serializeProjectFile, parseProjectFile } from '@/project/project-file'
import { exportSiteToHTML } from '@/lib/export-html'

const objects = [{ id: 'panel', type: 'panel', text: '', x: 10, y: 100, width: 50, height: 300, layer: 1, color: '#eeeeee' }, { id: 'text', parentId: 'panel', type: 'text', text: 'Welcome friends', x: 12, y: 120, width: 45, height: 70, layer: 2, textColor: '#000000' }]
const blocks = [{ id: 'hero', type: 'hero' as const, variant: 'minimal', props: { headline: 'Welcome friends', subheadline: 'Keep this text', headlineRich: [{ text: 'Welcome ', font: 'Georgia', bold: true, color: '#000000', line: 1 }, { text: 'friends', href: '/visit', font: 'Georgia', color: '#123456', line: 1 }], section1Objects: objects, apiKey: 'SECRET', formEndpoint: 'PRIVATE_ENDPOINT' } }, { id: 'footer', type: 'footer' as const, variant: 'simple', props: { copyright: 'Untouched' } }]
const config: SiteConfig = { name: 'Synthetic fixture', blocks, pages: [{ id: 'home', name: 'Home', path: '/', blocks }, { id: 'visit', name: 'Visit', path: '/visit', blocks: [{ id: 'private', type: 'content', variant: 'prose', props: { body: 'PRIVATE OTHER PAGE' } }] }] }
const scope = { pageId: 'home', target: 'page:home' }
const op = (action: EditOperation['action'], target: string, field: string, value: unknown): EditOperation => ({ action, target, field, value: JSON.stringify(value) })
const plan = (...operations: EditOperation[]) => ({ summary: 'Reviewed edits', operations })
describe('Gemini editing of existing content', () => {
  it('exposes normal scalar properties and exact targets without credentials or other-page content', () => {
    const context = JSON.stringify(editContext(config, { pageId: 'home', target: 'block:hero' }))
    expect(context).toContain('headline'); expect(context).toContain('headlineWidth')
    expect(context).not.toMatch(/SECRET|PRIVATE_ENDPOINT|PRIVATE OTHER PAGE/)
    expect(editTargets(config, 'home').some(target => target.id === 'object:hero:1:text')).toBe(true)
  })
  it('previews complete edits on a clone and preserves other content', () => {
    const original = structuredClone(config)
    const preview = previewEdits(config, scope, plan(op('set', 'block:hero', 'headline', 'A warmer welcome'), op('set', 'block:hero', 'blockBackgroundColor', '#eeeeee')))
    expect(config).toEqual(original); expect(preview.config.pages![1]).toEqual(config.pages![1])
    expect(preview.config.blocks[0].props.subheadline).toBe('Keep this text')
    expect(preview.config.blocks[0].props.headlineRich).toMatchObject([{ font: 'Georgia', bold: true, text: 'A warmer welcome' }])
    expect(acceptEdits(config, preview)).toEqual(preview.config)
  })
  it('accepts plain scalar color strings but still rejects wrong types and rendered layout overflow', () => {
    const preview = previewEdits(config, scope, plan({ action: 'set', target: 'block:hero', field: 'blockBackgroundColor', value: '#dceafa' }))
    expect(preview.config.blocks[0].props.blockBackgroundColor).toBe('#dceafa')
    expect(() => previewEdits(config, scope, plan({ action: 'set', target: 'block:hero', field: 'layoutWidth', value: 'narrow' }))).toThrow('Invalid')
    expect(() => previewEdits(config, scope, plan(op('set', 'block:hero', 'layoutTop', 5000)))).toThrow('Invalid')
  })
  it('formats only an exact phrase while retaining the rest and existing links', () => {
    const preview = previewEdits(config, scope, plan(op('textStyle', 'block:hero', 'headline', { text: 'friends', size: 28, color: '#0000ff' })))
    expect(preview.config.blocks[0].props.headlineRich).toEqual([{ text: 'Welcome ', font: 'Georgia', bold: true, color: '#000000', line: 1 }, { text: 'friends', href: '/visit', font: 'Georgia', color: '#0000ff', size: 28, line: 1 }])
  })
  it('moves a panel with its children and edits independent text', () => {
    const preview = previewEdits(config, scope, plan(op('move', 'object:hero:1:panel', '', { x: 20, y: 200 }), op('set', 'object:hero:1:text', 'text', 'Revised text')))
    const saved = preview.config.blocks[0].props.section1Objects as typeof objects
    expect(saved[0]).toMatchObject({ x: 20, y: 200 }); expect(saved[1]).toMatchObject({ x: 22, y: 220, text: 'Revised text' })
    const scalar = previewEdits(config, scope, plan(op('set', 'object:hero:1:panel', 'x', 20)))
    expect((scalar.config.blocks[0].props.section1Objects as typeof objects)[1].x).toBe(22)
  })
  it('adds and removes normal objects and reorders blocks', () => {
    const preview = previewEdits(config, scope, plan(op('addObject', 'object:hero:1:panel', '', { type: 'text', text: 'New child', x: 14, y: 200, width: 40, height: 60 }), op('move', 'block:footer', '', { index: 0 })))
    expect(preview.config.blocks[0].id).toBe('footer')
    expect((preview.config.blocks[1].props.section1Objects as Record<string, unknown>[]).at(-1)).toMatchObject({ type: 'text', parentId: 'panel', text: 'New child' })
    const deleted = previewEdits(config, scope, plan(op('remove', 'object:hero:1:panel', '', null)))
    expect(deleted.config.blocks[0].props.section1Objects).toEqual([])
  })
  it('rejects scope escape, scripts, invalid colors and incomplete transactions', () => {
    expect(() => previewEdits(config, { pageId: 'home', target: 'object:hero:1:text' }, plan(op('set', 'block:hero', 'headline', 'Bad')))).toThrow('outside')
    expect(() => previewEdits(config, scope, plan(op('set', 'block:hero', 'apiKey', 'Bad')))).toThrow('property')
    expect(() => previewEdits(config, scope, plan(op('set', 'block:hero', 'textColor', 'url(javascript:bad)')))).toThrow('Invalid')
    expect(() => previewEdits(config, scope, plan(op('set', 'block:hero', 'headline', 'Good'), op('set', 'block:footer', 'unknown', 'Bad')))).toThrow()
    expect(config.blocks[0].props.headline).toBe('Welcome friends')
  })
  it('rejects stale proposals and keeps the complete edit in normal Undo/Redo', () => {
    const preview = previewEdits(config, scope, plan(op('set', 'block:hero', 'headlineWidth', 500)))
    expect(() => acceptEdits({ ...config, name: 'Changed' }, preview)).toThrow('changed')
    useConfigStore.getState().setConfig(config); useConfigStore.getState().replaceConfig(acceptEdits(config, preview), 'Gemini: edit website')
    useConfigStore.getState().undo(); expect(useConfigStore.getState().config).toEqual(config)
    useConfigStore.getState().redo(); expect(useConfigStore.getState().config).toEqual(preview.config)
  })
  it('preserves AI changes through the normal portable serializer and static website exporter', () => {
    const preview = previewEdits(config, scope, plan(op('set', 'block:hero', 'blockBackgroundColor', '#dceafa'), op('linkText', 'block:hero', 'headline', { text: 'friends', url: '/visit' }), op('addObject', 'block:hero', '', { type: 'button', text: 'Visit us', x: 5, y: 300, width: 30, height: 44 })))
    const reopened = parseProjectFile(serializeProjectFile(createProjectFile(acceptEdits(config, preview), 'ai-edit-save-test'))).project.config
    expect(reopened).toEqual(preview.config)
    const html = exportSiteToHTML(reopened)
    expect(html).toContain('#dceafa'); expect(html).toContain('Visit us'); expect(html).toMatch(/href="(?:visit\/|\/visit|visit\.html)/)
  })
  it('refines an unapplied preview against its proposed state and applies the combined result once', () => {
    const first = previewEdits(config, scope, plan(op('set', 'block:hero', 'headlineWidth', 500)))
    const refined = refineEdits(config, scope, first, plan(op('set', 'block:hero', 'headlineWidth', 400), op('set', 'block:hero', 'textColor', '#123456')))
    expect(refined.before).toBe(JSON.stringify(config)); expect(refined.config.blocks[0].props.headlineWidth).toBe(400)
    expect(refined.changes).toHaveLength(3); expect(acceptEdits(config, refined).blocks[0].props.textColor).toBe('#123456')
    expect(() => refineEdits({ ...config, name: 'Intervening edit' }, scope, first, plan(op('set', 'block:hero', 'headlineWidth', 300)))).toThrow('changed')
  })
  it('uses existing media by id, preserving paths, captions and gallery ids through replacement and reorder', () => {
    const catalog = [{ id: 'photo1', name: 'Church.jpg', path: 'assets/photo1.jpg', mime: 'image/jpeg', folder: 'Church' }, { id: 'photo2', name: 'Portrait.jpg', path: 'assets/photo2.jpg', mime: 'image/jpeg' }, { id: 'bulletin', name: 'Bulletin.pdf', path: 'assets/bulletin.pdf', mime: 'application/pdf' }]
    const gallery = { id: 'gallery', type: 'gallery' as const, variant: 'responsive', props: { images: [{ id: 'existing', src: 'assets/photo1.jpg', assetId: 'photo1', caption: 'Keep caption', alt: 'Church' }] } }
    const fixture = structuredClone(config); fixture.pages![0].blocks.push(gallery); fixture.blocks = fixture.pages![0].blocks
    const preview = previewEdits(fixture, scope, plan(op('setMedia', 'item:gallery:images:existing', 'src', 'photo2'), op('addItem', 'block:gallery', 'images', { assetId: 'photo1', caption: 'New caption', alt: 'Church photo' })), catalog)
    const photos = preview.config.blocks.at(-1)!.props.images as Record<string, unknown>[]
    expect(() => previewEdits(fixture, { pageId: 'home', target: 'item:gallery:images:existing' }, plan(op('addObject', 'item:gallery:images:existing', '', { type: 'text', text: 'Outside selected item' })))).toThrow('block or panel')
    expect(photos[0]).toMatchObject({ id: 'existing', src: 'assets/photo2.jpg', assetId: 'photo2', caption: 'Keep caption' })
    expect(photos[1]).toMatchObject({ src: 'assets/photo1.jpg', assetId: 'photo1', caption: 'New caption' })
    expect(typeof photos[1].id).toBe('string')
    const context = JSON.stringify(editContext(fixture, scope, catalog))
    expect(context).toContain('Church.jpg'); expect(context).not.toContain('assets/photo2.jpg')
    expect(() => previewEdits(fixture, scope, plan(op('setMedia', 'item:gallery:images:existing', 'src', 'missing')), catalog)).toThrow('approved')
    expect(() => previewEdits(fixture, scope, plan(op('setMedia', 'item:gallery:images:existing', 'src', 'bulletin')), catalog)).toThrow('media type')
    const ordered = previewEdits(preview.config, scope, plan(op('move', 'item:gallery:images:' + photos[1].id, '', { index: 0 }), op('set', 'item:gallery:images:existing', 'caption', 'Revised caption')), catalog)
    expect((ordered.config.blocks.at(-1)!.props.images as Record<string, unknown>[])[1]).toMatchObject({ id: 'existing', caption: 'Revised caption' })
  })
  it('adds actual staff, bulletin and calendar data without replacing existing entries or inventing dates', () => {
    const fixture = structuredClone(config)
    fixture.pages![0].blocks.push({ id: 'staff', type: 'team', variant: 'directory', props: { members: [{ name: 'Existing member', role: 'Role', bio: 'Keep biography' }] } }, { id: 'calendar', type: 'calendar', variant: 'default', props: { events: [] } }, { id: 'bulletins', type: 'documentLibrary', variant: 'weekly-bulletins', props: { items: [] } })
    fixture.blocks = fixture.pages![0].blocks
    const catalog = [{ id: 'pdf', name: 'Bulletin.pdf', path: 'assets/bulletin.pdf', mime: 'application/pdf' }]
    const preview = previewEdits(fixture, scope, plan(op('addItem', 'block:staff', 'members', { name: 'New member', role: 'Volunteer', bio: 'Provided biography' }), op('addItem', 'block:calendar', 'events', { title: 'Provided event', date: '2026-11-20', time: '18:30' }), op('addItem', 'block:bulletins', 'items', { title: 'Current bulletin', assetId: 'pdf' })), catalog)
    expect((preview.config.blocks.find(block => block.id === 'staff')!.props.members as unknown[])[0]).toEqual(fixture.blocks.find(block => block.id === 'staff')!.props.members && { name: 'Existing member', role: 'Role', bio: 'Keep biography' })
    expect(preview.config.blocks.find(block => block.id === 'bulletins')!.props.items).toMatchObject([{ src: 'assets/bulletin.pdf', assetId: 'pdf' }])
    expect(() => previewEdits(fixture, scope, plan(op('addItem', 'block:calendar', 'events', { title: 'Invalid', date: '2026-02-30' })))).toThrow('real date')
  })
  it('keeps parent navigation clickable, adds submenus and links exact text without losing rich formatting', () => {
    const fixture = structuredClone(config)
    fixture.pages![0].blocks.push({ id: 'nav', type: 'navbar', variant: 'default', props: { navItems: [{ id: 'about', label: 'About', url: '/visit', children: [] }] } })
    fixture.blocks = fixture.pages![0].blocks
    const preview = previewEdits(fixture, scope, plan(op('addItem', 'item:nav:navItems:about', 'children', { label: 'Staff', url: '/visit' }), op('linkText', 'block:hero', 'headline', { text: 'friends', url: 'https://webstudio.local/visit' })))
    const nav = preview.config.blocks.find(block => block.id === 'nav')!.props.navItems as Record<string, unknown>[]
    expect(nav[0]).toMatchObject({ label: 'About', url: '/visit', children: [{ label: 'Staff', url: '/visit' }] })
    expect(preview.config.blocks[0].props.headlineRich).toMatchObject([{ text: 'Welcome ', bold: true, color: '#000000' }, { text: 'friends', href: '/visit', font: 'Georgia' }])
    expect(() => previewEdits(fixture, scope, plan(op('set', 'item:nav:navItems:about', 'url', '/missing')))).toThrow('missing')
    expect(() => previewEdits(fixture, scope, plan(op('set', 'item:nav:navItems:about', 'url', 'javascript:alert(1)')))).toThrow('Only')
  })
  it('creates and renames anchors and repairs incoming links while preserving other pages', () => {
    const fixture = structuredClone(config)
    fixture.pages![0].blocks[0].props = { ...fixture.blocks[0].props, anchorName: 'welcome' }
    fixture.pages![1].blocks[0].props = { body: 'Go to welcome', bodyRich: [{ text: 'welcome', href: '/#welcome' }] }
    fixture.blocks = fixture.pages![0].blocks
    const preview = previewEdits(fixture, scope, plan(op('set', 'block:hero', 'anchorName', 'greeting'), op('linkText', 'block:hero', 'headline', { text: 'friends', url: '#greeting' })))
    expect(preview.config.pages![1].blocks[0].props.bodyRich).toMatchObject([{ href: '/#greeting' }])
    expect(preview.affectedPages).toEqual(['home', 'visit'])
    expect(() => previewEdits(fixture, scope, plan(op('linkText', 'block:hero', 'headline', { text: 'friends', url: '#missing' })))).toThrow('anchor')
  })
  it('preserves markdown headings, lists and emphasis when adding an inline link', () => {
    const fixture = structuredClone(config)
    fixture.pages![0].blocks.push({ id: 'prose', type: 'content', variant: 'prose', props: { body: '## Mission Churches\n\n- **St. William** in Sandersville\n- Another church' } })
    fixture.blocks = fixture.pages![0].blocks
    const preview = previewEdits(fixture, scope, plan(op('linkText', 'block:prose', 'body', { text: 'St. William', url: '/visit' })))
    const runs = preview.config.blocks.at(-1)!.props.bodyRich as Record<string, unknown>[]
    expect(runs[0]).toMatchObject({ text: 'Mission Churches', tag: 'h2' })
    expect(runs.some(run => run.text === 'St. William' && run.bold === true && run.href === '/visit' && run.tag === 'li')).toBe(true)
  })
})
