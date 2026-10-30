import { describe, expect, it } from 'vitest'
import { createProjectFile, parseProjectFile, serializeProjectFile, validateProjectConfig, validateProjectMedia } from '../src/project/project-file'
import type { SiteConfig } from '../src/blocks/types'

const legacy = { name: 'My site', blocks: [{ id: 'hero', type: 'hero', variant: 'centered', props: { headline: 'Hello' } }] }
const fivePages = {
  name: 'Five pages',
  pages: ['/', '/about', '/news', '/documents', '/contact'].map((path, index) => ({
    id: `page-${index}`, name: `Page ${index}`, path,
    blocks: [{ id: `block-${index}`, type: 'content', variant: 'prose', props: { body: `Page ${index} text` } }],
  })),
}

describe('portable project files', () => {
  it('migrates legacy JSON without changing the input and creates a stable portable identity', () => {
    const source = JSON.stringify(legacy)
    const { project, migrated } = parseProjectFile(source)
    expect(migrated).toBe(true)
    expect(project.schemaVersion).toBe(2)
    expect(project.config.pages?.[0]).toMatchObject({ id: 'page-home', path: '/', blocks: legacy.blocks })
    expect(JSON.stringify(legacy)).toBe(source)
    const reopened = parseProjectFile(serializeProjectFile(project))
    expect(reopened.migrated).toBe(false)
    expect(reopened.project).toEqual(project)
  })

  it('round-trips five pages and preserves unknown project/page/block fields and block types', () => {
    const source = structuredClone(fivePages)
    source.pages[2].blocks[0] = { id: 'future', type: 'future-chart', variant: 'custom', props: { series: [1, 2] } } as unknown as typeof source.pages[2]['blocks'][0]
    const config = { ...source, customSetting: { locale: 'de' } }
    Object.assign(config.pages[2], { futurePageField: { x: 1 } })
    Object.assign(config.pages[2].blocks[0], { pluginVersion: 8 })
    const project = { ...createProjectFile(config as unknown as SiteConfig, 'stable-id'), futureProjectField: { preserved: true } }
    const reopened = parseProjectFile(serializeProjectFile(project)).project
    expect(reopened).toEqual(project)
    expect(reopened.config.pages).toHaveLength(5)
    expect(reopened.config.blocks).toEqual(config.pages[0].blocks)
  })

  it('uses Home blocks regardless of the previously active page compatibility mirror', () => {
    const config = { ...fivePages, blocks: fivePages.pages[3].blocks }
    expect(validateProjectConfig(config).blocks).toEqual(fivePages.pages[0].blocks)
    expect(config.blocks).toEqual(fivePages.pages[3].blocks)
  })

  it('preserves empty pages and rejects conflicting orphan legacy blocks', () => {
    const config = structuredClone(fivePages)
    config.pages[2].blocks = []
    expect(validateProjectConfig(config).pages?.[2].blocks).toEqual([])
    expect(() => validateProjectConfig({ ...config, blocks: legacy.blocks })).toThrow('Legacy blocks differ')
  })

  it.each(['/../escape', '/a/../../b', '//host/path', '/a\\b', '/%2e%2e/escape', '/a%2fb', '/a?x=1', '/a#x', '/a//b', '/CON', '/nul.txt', '/about.', '/a*b'])('rejects unsafe path %s', path => {
    const config = structuredClone(fivePages)
    config.pages[1].path = path
    expect(() => validateProjectConfig(config)).toThrow()
  })

  it('rejects duplicate IDs and paths, including Windows path case collisions', () => {
    for (const field of ['id', 'path'] as const) {
      const config = structuredClone(fivePages)
      config.pages[2][field] = config.pages[1][field].toUpperCase()
      if (field === 'id') config.pages[2].id = config.pages[1].id
      expect(() => validateProjectConfig(config)).toThrow('Duplicate page')
    }
    const config = structuredClone(fivePages)
    config.pages[2].blocks[0].id = config.pages[1].blocks[0].id
    expect(() => validateProjectConfig(config)).toThrow('Duplicate block ID')
  })

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///C:/secret', 'vbscript:msgbox(1)'])('rejects active or privileged URL %s', url => {
    expect(() => validateProjectConfig({ ...legacy, blocks: [{ ...legacy.blocks[0], props: { primaryCtaUrl: url } }] })).toThrow('URL protocol')
  })

  it('rejects prototype keys, malformed JSON, unknown versions, missing Home and unsafe font interpolation', () => {
    expect(() => parseProjectFile('{')).toThrow('valid JSON')
    expect(() => parseProjectFile('{"name":"x","blocks":[],"__proto__":{}}')).toThrow('Unsafe project property')
    expect(() => parseProjectFile('{"format":"webstudio","schemaVersion":99,"config":{}}')).toThrow('Unsupported project')
    expect(() => validateProjectConfig({ name: 'x', pages: [{ id: 'p', name: 'P', path: '/about', blocks: [] }] })).toThrow('Home')
    expect(() => validateProjectConfig({ ...legacy, theme: { fontSans: "x';alert(1)//" } })).toThrow('font')
  })

  it('rejects non-JSON editor values instead of silently losing them during save', () => {
    for (const value of [Infinity, NaN, () => 1, BigInt(1)]) {
      expect(() => validateProjectConfig({ ...legacy, extra: value })).toThrow()
    }
  })

  it('round-trips site settings and rejects embedded deployment credentials', () => {
    const project = { ...createProjectFile(legacy as SiteConfig, 'p'), settings: { seoTitle: 'My site', future: { retained: true } } }
    expect(parseProjectFile(serializeProjectFile(project)).project.settings).toEqual(project.settings)
    expect(() => serializeProjectFile({ ...project, settings: { deployAccessKey: 'secret' } })).toThrow('credentials')
    expect(() => parseProjectFile(JSON.stringify({ ...project, settings: { deployAccessKey: 'secret' } }))).toThrow('credential')
  })

  it('rejects missing, mismatched, or duplicate media references before open or save', () => {
    const assets = [{ id: 'one', path: 'assets/one-image.png' }, { id: 'two', path: 'assets/two-image.png' }]
    const config = { name: 'Media', blocks: [{ id: 'img', type: 'image', variant: 'grid', props: { assetId: 'one', src: 'assets/one-image.png', images: [{ src: 'assets/two-image.png' }] } }] } as SiteConfig
    expect(() => validateProjectMedia(config, assets)).not.toThrow()
    expect(() => validateProjectMedia(config, assets.slice(0, 1))).toThrow('Missing project media file')
    expect(() => validateProjectMedia(config, assets.slice(1))).toThrow('Missing project media ID')
    expect(() => validateProjectMedia(config, [...assets, { id: 'one', path: 'assets/other.png' }])).toThrow('duplicate media')
    expect(() => validateProjectMedia(config, [...assets, { id: 'three', path: 'assets/ONE-image.png' }])).toThrow('duplicate media')
    const mismatched = structuredClone(config)
    mismatched.blocks[0].props.src = 'assets/two-image.png'
    expect(() => validateProjectMedia(mismatched, assets)).toThrow('do not match')
  })

  it('retains unknown block data without interpreting plugin-specific media references', () => {
    const config = { name: 'Future', blocks: [{ id: 'future', type: 'future-chart', variant: 'custom', props: { src: 'assets/plugin-file.bin' } }] } as unknown as SiteConfig
    expect(() => validateProjectMedia(config, [])).not.toThrow()
  })
})
