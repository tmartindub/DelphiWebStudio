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
    expect(home).toContain('flex flex-wrap gap-x-4 gap-y-2')
    expect(home).toContain('aria-current="page"')
    expect(news).toContain('href="../index.html"')
    expect(home).not.toContain('cdn.tailwindcss.com')
    expect(home).not.toContain('fonts.googleapis.com')
    expect(home).toContain('.text-text-0')
    expect(home).toContain('.font-display')
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

  it('packages referenced PDF bytes and uses the correct nested relative path', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks = [{ id: 'pdf', type: 'pdfViewer', variant: 'default', props: { title: 'Bulletin', src: 'assets/example.pdf' } }]
    const media = [{ id: 'example', projectId: 'p', name: 'bulletin.pdf', path: 'assets/example.pdf', mime: 'application/pdf', size: 9, sha256: 'x', content: new Blob(['%PDF-test'], { type: 'application/pdf' }) }]
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, undefined, media)).arrayBuffer())
    expect(await zip.file('assets/example.pdf')!.async('string')).toBe('%PDF-test')
    expect(await zip.file('community/news.html')!.async('string')).toContain('src="../assets/pdfjs/viewer.html?file=..%2Fexample.pdf"')
    expect(zip.file('assets/pdfjs/pdf.worker.min.js')).not.toBeNull()
    expect(zip.file('assets/pdfjs/viewer.js')).not.toBeNull()
    await expect(exportSiteZip(site)).rejects.toThrow('Missing media file')
  })

  it('retains an alternating feature image on a nested page', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks = [{ id: 'feature', type: 'features', variant: 'alternating', props: { title: 'Stories', items: [{ title: 'Photo', description: 'Example', image: 'assets/photo.png' }] } }]
    const media = [{ id: 'photo', projectId: 'p', name: 'photo.png', path: 'assets/photo.png', mime: 'image/png', size: 5, sha256: 'x', content: new Blob(['image'], { type: 'image/png' }) }]
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, undefined, media)).arrayBuffer())
    expect(await zip.file('assets/photo.png')!.async('string')).toBe('image')
    expect(await zip.file('community/news.html')!.async('string')).toContain('src="../assets/photo.png"')
  })

  it('rewrites links to project pages to portable relative HTML paths', async () => {
    const site = structuredClone(config)
    site.pages![0].blocks = [{ id: 'hero', type: 'hero', variant: 'centered', props: { headline: 'Home', primaryCta: 'About', primaryCtaUrl: '/about?x=1&y=2#team', secondaryCta: 'External', secondaryCtaUrl: 'https://example.com/about' } }]
    site.pages![1].blocks = [{ id: 'cta', type: 'cta', variant: 'simple', props: { headline: 'News', buttonText: 'Home', buttonUrl: '/#welcome' } }]
    site.blocks = site.pages![0].blocks
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site)).arrayBuffer())
    const home = await zip.file('index.html')!.async('string')
    const news = await zip.file('community/news.html')!.async('string')
    expect(home).toContain('href="about.html?x=1&amp;y=2#team"')
    expect(home).toContain('href="https://example.com/about"')
    expect(news).toContain('href="../index.html#welcome"')
  })

  it.each(['/assets/pdfjs/viewer', '/assets/PDFJS/viewer', '/assets/pdfjs/viewer.html/nested'])('rejects a page that conflicts with the bundled PDF viewer at %s', async path => {
    const site = structuredClone(config)
    site.pages![0].blocks = [{ id: 'pdf', type: 'pdfViewer', variant: 'default', props: { src: 'assets/example.pdf' } }]
    site.blocks = site.pages![0].blocks
    site.pages![1].path = path
    const media = [{ id: 'example', projectId: 'p', name: 'bulletin.pdf', path: 'assets/example.pdf', mime: 'application/pdf', size: 9, sha256: 'x', content: new Blob(['%PDF-test'], { type: 'application/pdf' }) }]
    await expect(exportSiteZip(site, undefined, media)).rejects.toThrow('conflicts with an exported asset or folder')
  })

  it('creates an optional sitemap with absolute URLs under the configured site folder', async () => {
    const absent = await JSZip.loadAsync(await (await exportSiteZip(config)).arrayBuffer())
    expect(absent.file('sitemap.xml')).toBeNull()
    const site = structuredClone(config)
    site.pages![2].path = '/a&b'
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings: { siteBaseUrl: 'https://example.com/site' } })).arrayBuffer())
    const sitemap = await zip.file('sitemap.xml')!.async('string')
    expect(sitemap).toContain('<loc>https://example.com/site/index.html</loc>')
    expect(sitemap).toContain('<loc>https://example.com/site/community/news.html</loc>')
    expect(sitemap).toContain('<loc>https://example.com/site/a&amp;b.html</loc>')
    expect(zip.file('robots.txt')).toBeNull()
  })

  it.each(['example.com', 'javascript:alert(1)', 'https://user:pass@example.com/', 'https://example.com/?x=1', 'https://example.com/#section', 'https://example.com\\site'])('rejects an invalid public site URL %s', async siteBaseUrl => {
    await expect(exportSiteZip(config, { settings: { siteBaseUrl } })).rejects.toThrow('Public site URL')
  })

  it('rejects a page path that conflicts with the generated sitemap', async () => {
    const site = structuredClone(config)
    site.pages![1].path = '/sitemap.xml/nested'
    await expect(exportSiteZip(site, { settings: { siteBaseUrl: 'https://example.com/' } })).rejects.toThrow('conflicts with an exported asset or folder')
  })

  it('adds optional local site search without indexing contact addresses', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks.push({ id: 'contact', type: 'contact', variant: 'form', props: { title: 'Questions', recipientEmail: 'secret@example.com' } } as never)
    const absent = await JSZip.loadAsync(await (await exportSiteZip(site)).arrayBuffer())
    expect(absent.file('search.html')).toBeNull()
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings: { siteSearch: 'on' } })).arrayBuffer())
    const search = await zip.file('search.html')!.async('string')
    const news = await zip.file('community/news.html')!.async('string')
    expect(search).toContain('Latest text')
    expect(search).not.toContain('secret@example.com')
    expect(search).toContain('name="robots" content="noindex"')
    expect(news).toContain('href="../search.html"')
  })

  it('keeps markup in search content from becoming a script', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks[0].props.body = '</script><script>window.injected=true</script>'
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings: { siteSearch: 'on' } })).arrayBuffer())
    const search = await zip.file('search.html')!.async('string')
    expect(search).not.toContain('</script><script>window.injected=true</script>')
    expect(search).toContain('\\u003c/script>\\u003cscript>window.injected=true\\u003c/script>')
  })

  it('rejects page paths that conflict with the optional search page', async () => {
    const site = structuredClone(config)
    site.pages![1].path = '/SEARCH'
    await expect(exportSiteZip(site, { settings: { siteSearch: 'on' } })).rejects.toThrow('conflicts with an exported asset or folder')
  })

  it('omits draft article pages and their media from site, navigation, search and sitemap', async () => {
    const site = structuredClone(config)
    site.pages![1].webstudioArticle = { status: 'draft', author: 'Author', summary: 'Private draft', createdAt: '2026-01-01', modifiedAt: '2026-01-01' }
    site.pages![1].blocks = [{ id: 'img', type: 'image', variant: 'hero-image', props: { src: 'assets/draft.png' } }]
    site.pages![2].webstudioArticle = { status: 'ready', author: 'Ada', summary: 'Public article', createdAt: '2026-01-01', modifiedAt: '2026-01-01' }
    const media = [{ id: 'draft', projectId: 'p', name: 'draft.png', path: 'assets/draft.png', mime: 'image/png', size: 5, sha256: 'x', content: new Blob(['image'], { type: 'image/png' }) }]
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings: { siteSearch: 'on', siteBaseUrl: 'https://example.com/' } }, media)).arrayBuffer())
    expect(zip.file('community/news.html')).toBeNull()
    expect(zip.file('assets/draft.png')).toBeNull()
    expect(await zip.file('index.html')!.async('string')).not.toContain('community/news.html')
    expect(await zip.file('search.html')!.async('string')).not.toContain('Private draft')
    expect(await zip.file('sitemap.xml')!.async('string')).not.toContain('community/news.html')
    expect(await zip.file('sitemap.xml')!.async('string')).toContain('https://example.com/articles/index.html')
    const article = await zip.file('about.html')!.async('string')
    expect(article).toContain('By Ada')
    expect(article).toContain('Public article')
    const archive = await zip.file('articles/index.html')!.async('string')
    expect(archive).toContain('href="../about.html"')
    expect(archive).not.toContain('Private draft')
    const feed = await zip.file('feed.xml')!.async('string')
    expect(feed).toContain('<link>https://example.com/about.html</link>')
    expect(feed).toContain('<description>Public article</description>')
    expect(feed).not.toContain('Private draft')
  })

  it('rejects an exported page link to a draft article', async () => {
    const site = structuredClone(config)
    site.pages![1].webstudioArticle = { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' }
    site.pages![0].blocks = [{ id: 'cta', type: 'cta', variant: 'simple', props: { headline: 'News', buttonText: 'Read', buttonUrl: '/community/news' } }]
    site.blocks = site.pages![0].blocks
    await expect(exportSiteZip(site)).rejects.toThrow('links to the draft article')
  })

  it('exports an article index without a feed when no public URL is configured', async () => {
    const site = structuredClone(config)
    site.pages![2].webstudioArticle = { status: 'ready', author: '', summary: '', createdAt: '', modifiedAt: '' }
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site)).arrayBuffer())
    expect(zip.file('articles/index.html')).not.toBeNull()
    expect(zip.file('feed.xml')).toBeNull()
  })

  it('rejects a page whose output would overwrite the article index', async () => {
    const site = structuredClone(config)
    site.pages![1].path = '/articles/index'
    site.pages![2].webstudioArticle = { status: 'ready', author: '', summary: '', createdAt: '', modifiedAt: '' }
    await expect(exportSiteZip(site)).rejects.toThrow('conflicts with an exported asset or folder')
  })

  it('rejects invalid XML characters in article feeds', async () => {
    const site = structuredClone(config)
    site.pages![2].webstudioArticle = { status: 'ready', author: '', summary: 'bad\u0001text', createdAt: '', modifiedAt: '' }
    await expect(exportSiteZip(site, { settings: { siteBaseUrl: 'https://example.com/' } })).rejects.toThrow('cannot be written to XML')
  })
})
