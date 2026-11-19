import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { exportSiteZip } from '../src/lib/export-html'
import type { SiteConfig } from '../src/blocks/types'

const pages = [
  { id: 'home', name: 'Home', path: '/', blocks: [{ id: 'h', type: 'content' as const, variant: 'prose', props: { body: '## Welcome\nHome text' } }] },
  { id: 'news', name: 'News', path: '/community/news', blocks: [{ id: 'n', type: 'content' as const, variant: 'prose', props: { body: '## News\nLatest text' } }] },
  { id: 'about', name: 'About', path: '/about', blocks: [] },
]
const config: SiteConfig = { name: 'Example', pages, blocks: pages[0].blocks }

describe('multi-page export', () => {
  it('exports each page, preserves content and produces relative navigation from nested paths', async () => {
    const zip = await JSZip.loadAsync(await (await exportSiteZip(config)).arrayBuffer())
    const home = await zip.file('index.html')!.async('string')
    const news = await zip.file('community/news.html')!.async('string')
    const about = await zip.file('about.html')!.async('string')
    expect(home).toContain('Home text')
    expect(home).toContain('href="community/news.html"')
    expect(news).toContain('Latest text')
    expect(news).toContain('href="../index.html"')
    expect(news).toContain('href="../about.html"')
    expect(about).toContain('aria-label="Site pages"')
  })

  it('rejects unsupported blocks instead of silently dropping them', async () => {
    const invalid = structuredClone(config)
    invalid.pages![1].blocks[0].type = 'future' as never
    await expect(exportSiteZip(invalid)).rejects.toThrow('unsupported block future')
  })

  it('rejects page names that would overwrite the home export', async () => {
    const invalid = structuredClone(config)
    invalid.pages![1].path = '/index'
    await expect(exportSiteZip(invalid)).rejects.toThrow('duplicate export filenames')
  })
})
