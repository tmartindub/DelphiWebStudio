import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { exportSiteZip } from '../src/lib/export-html'
import { createProjectFile, parseProjectFile, serializeProjectFile } from '../src/project/project-file'
import type { SiteConfig } from '../src/blocks/types'

const pages = [
  { id: 'home', name: 'Home', path: '/', blocks: [{ id: 'h', type: 'content' as const, variant: 'prose', props: { body: '## Welcome\nHome text' } }] },
  { id: 'news', name: 'News', path: '/community/news', blocks: [{ id: 'n', type: 'content' as const, variant: 'prose', props: { body: '## News\nLatest text' } }] },
  { id: 'about', name: 'About', path: '/about', blocks: [] },
]
const config: SiteConfig = { name: 'Example', pages, blocks: pages[0].blocks }

describe('multi-page export', () => {
  it('exports configured HTTPS contact service forms and disables unsafe endpoints', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks.push({ id: 'contact-service', type: 'contact', variant: 'form', props: { formEndpoint: 'https://forms.example.test/submit?site=one&mode=post', consentNotice: 'I agree to the privacy notice.' } })
    let zip = await JSZip.loadAsync(await (await exportSiteZip(site)).arrayBuffer())
    let html = await zip.file('community/news.html')!.async('string')
    expect(html).toContain('action="https://forms.example.test/submit?site=one&amp;mode=post" method="post"')
    expect(html).toContain('name="message" required')
    expect(html).toContain('name="consent" value="yes" required')
    expect(html).toContain('I agree to the privacy notice.')
    site.pages![1].blocks.at(-1)!.props.formEndpoint = 'http://forms.example.test/submit'
    zip = await JSZip.loadAsync(await (await exportSiteZip(site)).arrayBuffer())
    html = await zip.file('community/news.html')!.async('string')
    expect(html).not.toContain('action="http://forms.example.test/submit"')
    expect(html).toContain('<fieldset disabled')
  })
  it('preserves page-specific custom code through project save and nested ZIP export', async () => {
    const site = structuredClone(config)
    const custom = { html: '<p id="welcome">Hello $&</p>', css: '#welcome { color: red; }', js: 'document.querySelector("#welcome").textContent = "Ready";' }
    site.pages![1].webstudioCustomCode = custom
    const reopened = parseProjectFile(serializeProjectFile(createProjectFile(site, 'test-project'))).project.config
    expect(reopened.pages![1].webstudioCustomCode).toEqual(custom)
    const zip = await JSZip.loadAsync(await (await exportSiteZip(reopened)).arrayBuffer())
    const news = await zip.file('community/news.html')!.async('string')
    const home = await zip.file('index.html')!.async('string')
    expect(news).toContain(custom.html)
    expect(news).toContain('href="../webstudio-custom/page-1.css"')
    expect(news).toContain('src="../webstudio-custom/page-1.js"')
    expect(await zip.file('webstudio-custom/page-1.css')!.async('string')).toBe(custom.css)
    expect(await zip.file('webstudio-custom/page-1.js')!.async('string')).toBe(custom.js)
    expect(home).not.toContain('webstudio-custom/page-1')
  })
  it.each(['simple', 'multi-column', 'minimal'])('exports %s footer destinations as working nested links', async variant => {
    const site = structuredClone(config)
    site.pages![1].blocks.push({ id: 'footer', type: 'footer', variant, props: { logo: 'Club', copyright: '', links: ['Legacy'], navItems: [{ label: 'About & us', url: '/about?from=news#team' }, { label: 'Unsafe', url: '//example.com' }] } })
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site)).arrayBuffer())
    const news = await zip.file('community/news.html')!.async('string')
    expect(news).toMatch(/href="\.\.\/about\.html\?from=news#team"[^>]*>About &amp; us<\/a>/)
    expect(news).toContain('Legacy')
    expect(news).not.toContain('href="//example.com"')
  })
  it('blocks footer links to draft articles', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks.push({ id: 'footer', type: 'footer', variant: 'simple', props: { links: [], navItems: [{ label: 'Draft', url: '/about' }] } })
    site.pages![2].webstudioArticle = { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' }
    await expect(exportSiteZip(site)).rejects.toThrow('links to the draft article')
  })
  it('exports navbar destinations on desktop and mobile with nested page links', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks.push({ id: 'nav', type: 'navbar', variant: 'default', props: { logo: 'Club', links: ['Legacy'], navItems: [{ label: 'About club', url: '/about' }] } })
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site)).arrayBuffer())
    const news = await zip.file('community/news.html')!.async('string')
    expect(news).toContain('aria-label="Navigation menu"')
    expect(news.match(/href="\.\.\/about\.html"[^>]*>About club<\/a>/g)).toHaveLength(2)
    expect(news).toContain('Legacy')
  })
  it('exports individual page search titles and descriptions with site-wide fallbacks', async () => {
    const site = structuredClone(config)
    site.pages![1].webstudioSeo = { title: 'News & updates', description: 'Latest "community" news' }
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings: { seoTitle: 'Community Site', seoDescription: 'Site-wide description' } })).arrayBuffer())
    const home = await zip.file('index.html')!.async('string')
    const news = await zip.file('community/news.html')!.async('string')
    expect(home).toContain('<title>Community Site</title>')
    expect(home).toContain('Site-wide description')
    expect(news).toContain('<title>News &amp; updates</title>')
    expect(news).toContain('Latest &quot;community&quot; news')
    expect(news).toContain('property="og:title" content="News &amp; updates"')
  })
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

  it.each(['/COM¹', '/pages/lpt².html', '/com³/details'])('keeps a project with %s readable but blocks an incompatible Windows export', async path => {
    const site = structuredClone(config)
    site.pages![1].path = path
    const project = createProjectFile(site, 'test-project')
    expect(parseProjectFile(serializeProjectFile(project)).project.config.pages![1].path).toBe(path)
    await expect(exportSiteZip(site)).rejects.toThrow('Windows-reserved address')
  })

  it('packages referenced PDF bytes and uses the correct nested relative path', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks = [{ id: 'pdf', type: 'pdfViewer', variant: 'default', props: { title: 'Bulletin', src: 'assets/example.pdf' } }]
    const media = [{ id: 'example', projectId: 'p', name: 'bulletin.pdf', path: 'assets/example.pdf', mime: 'application/pdf', size: 9, sha256: '3c87d37f1dbea6909f917ce437c390fb8e655a774387d9e69301c0b2283d5b63', content: new Blob(['%PDF-test'], { type: 'application/pdf' }) }]
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, undefined, media)).arrayBuffer())
    expect(await zip.file('assets/example.pdf')!.async('string')).toBe('%PDF-test')
    const html = await zip.file('community/news.html')!.async('string')
    expect(html).toContain('src="../assets/pdfjs/viewer.html?file=..%2Fexample.pdf"')
    expect(html).toContain('data-webstudio-pdf-local-notice hidden')
    expect(html).toContain("location.protocol==='file:'")
    expect(zip.file('assets/pdfjs/pdf.worker.min.js')).not.toBeNull()
    expect(zip.file('assets/pdfjs/viewer.js')).not.toBeNull()
    await expect(exportSiteZip(site)).rejects.toThrow('Missing media file')
  })

  it('exports PDF starting page, caption and requested toolbar options', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks = [{ id: 'pdf', type: 'pdfViewer', variant: 'default', props: {
      title: 'Bulletin', caption: 'Read & enjoy', accessibilityLabel: 'Community bulletin', mobileMode: 'link', src: 'assets/example.pdf', initialPage: 3, fitMode: 'page', showThumbnails: true,
      showSearch: false, showPrint: false, showDownload: false, showFullscreen: false,
    } }]
    const media = [{ id: 'example', projectId: 'p', name: 'bulletin.pdf', path: 'assets/example.pdf', mime: 'application/pdf', size: 9, sha256: '3c87d37f1dbea6909f917ce437c390fb8e655a774387d9e69301c0b2283d5b63', content: new Blob(['%PDF-test'], { type: 'application/pdf' }) }]
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, undefined, media)).arrayBuffer())
    const html = await zip.file('community/news.html')!.async('string')
    expect(html).toContain('Read &amp; enjoy')
    expect(html).toContain('title="Community bulletin"')
    expect(html).toContain('ws-pdf-mobile-link')
    expect(html).toContain('page=3&amp;fit=page&amp;thumbnails=1&amp;search=0&amp;print=0&amp;download=0&amp;fullscreen=0')
    expect(html.match(/Open or download PDF/g)).toHaveLength(1)
  })

  it('exports a searchable document library with local links on nested pages', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks = [{ id: 'docs', type: 'documentLibrary', variant: 'default', props: { title: 'Library', items: [{ title: 'Bulletin', description: 'Community news', src: 'assets/example.pdf', assetId: 'example' }] } }]
    const media = [{ id: 'example', projectId: 'p', name: 'bulletin.pdf', path: 'assets/example.pdf', mime: 'application/pdf', size: 9, sha256: '3c87d37f1dbea6909f917ce437c390fb8e655a774387d9e69301c0b2283d5b63', content: new Blob(['%PDF-test'], { type: 'application/pdf' }) }]
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, undefined, media)).arrayBuffer())
    const html = await zip.file('community/news.html')!.async('string')
    expect(html).toContain('href="../assets/example.pdf"')
    expect(html).toContain('data-library-search')
    expect(html).toContain('data-library-item')
    expect(html).toContain("querySelectorAll('[data-document-library]')")
    expect(await zip.file('assets/example.pdf')!.async('string')).toBe('%PDF-test')
  })

  it('retains an alternating feature image on a nested page', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks = [{ id: 'feature', type: 'features', variant: 'alternating', props: { title: 'Stories', items: [{ title: 'Photo', description: 'Example', image: 'assets/photo.png' }] } }]
    const media = [{ id: 'photo', projectId: 'p', name: 'photo.png', path: 'assets/photo.png', mime: 'image/png', size: 5, sha256: '6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d', content: new Blob(['image'], { type: 'image/png' }) }]
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, undefined, media)).arrayBuffer())
    expect(await zip.file('assets/photo.png')!.async('string')).toBe('image')
    expect(await zip.file('community/news.html')!.async('string')).toContain('src="../assets/photo.png"')
  })

  it('packages media linked from content and rewrites links on nested pages', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks = [{ id: 'text', type: 'content', variant: 'prose', props: { body: '[Bulletin](assets/example.pdf#page=2) and [About](/about)' } }]
    const media = [{ id: 'example', projectId: 'p', name: 'bulletin.pdf', path: 'assets/example.pdf', mime: 'application/pdf', size: 9, sha256: '3c87d37f1dbea6909f917ce437c390fb8e655a774387d9e69301c0b2283d5b63', content: new Blob(['%PDF-test'], { type: 'application/pdf' }) }]
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, undefined, media)).arrayBuffer())
    expect(await zip.file('assets/example.pdf')!.async('string')).toBe('%PDF-test')
    const news = await zip.file('community/news.html')!.async('string')
    expect(news).toContain('href="../assets/example.pdf#page=2"')
    expect(news).toContain('href="../about.html"')
    await expect(exportSiteZip(site)).rejects.toThrow('Missing media file')
  })

  it('refuses to export media whose bytes do not match its recorded checksum', async () => {
    const site = structuredClone(config)
    site.pages![1].blocks = [{ id: 'feature', type: 'features', variant: 'alternating', props: { title: 'Stories', items: [{ title: 'Photo', description: '', image: 'assets/photo.png' }] } }]
    const media = [{ id: 'photo', projectId: 'p', name: 'photo.png', path: 'assets/photo.png', mime: 'image/png', size: 5, sha256: '6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d', content: new Blob(['other'], { type: 'image/png' }) }]
    await expect(exportSiteZip(site, undefined, media)).rejects.toThrow('Media integrity check failed for photo.png')
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
    const media = [{ id: 'example', projectId: 'p', name: 'bulletin.pdf', path: 'assets/example.pdf', mime: 'application/pdf', size: 9, sha256: '3c87d37f1dbea6909f917ce437c390fb8e655a774387d9e69301c0b2283d5b63', content: new Blob(['%PDF-test'], { type: 'application/pdf' }) }]
    await expect(exportSiteZip(site, undefined, media)).rejects.toThrow('conflicts with an exported asset or folder')
  })

  it('creates an optional sitemap with absolute URLs under the configured site folder', async () => {
    const absent = await JSZip.loadAsync(await (await exportSiteZip(config)).arrayBuffer())
    expect(absent.file('sitemap.xml')).toBeNull()
    expect(await absent.file('index.html')!.async('string')).not.toContain('rel="canonical"')
    const site = structuredClone(config)
    site.pages![2].path = '/a&b'
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings: { siteBaseUrl: 'https://example.com/site' } })).arrayBuffer())
    const sitemap = await zip.file('sitemap.xml')!.async('string')
    expect(sitemap).toContain('<loc>https://example.com/site/index.html</loc>')
    expect(sitemap).toContain('<loc>https://example.com/site/community/news.html</loc>')
    expect(sitemap).toContain('<loc>https://example.com/site/a&amp;b.html</loc>')
    const home = await zip.file('index.html')!.async('string')
    const news = await zip.file('community/news.html')!.async('string')
    const about = await zip.file('a&b.html')!.async('string')
    expect(home).toContain('<link rel="canonical" href="https://example.com/site/index.html" />')
    expect(news).toContain('<meta property="og:url" content="https://example.com/site/community/news.html" />')
    expect(about).toContain('href="https://example.com/site/a&amp;b.html"')
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
    site.pages![1].webstudioArticle = { status: 'draft', author: 'Author', summary: 'Private draft', tags: ['secret tag'], createdAt: '2026-01-01', modifiedAt: '2026-01-01' }
    site.pages![1].blocks = [{ id: 'img', type: 'image', variant: 'hero-image', props: { src: 'assets/draft.png' } }]
    site.pages![2].webstudioArticle = { status: 'ready', author: 'Ada', summary: 'Public article', tags: ['News & events'], createdAt: '2026-01-01', modifiedAt: '2026-01-01' }
    const media = [{ id: 'draft', projectId: 'p', name: 'draft.png', path: 'assets/draft.png', mime: 'image/png', size: 5, sha256: '6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d', content: new Blob(['image'], { type: 'image/png' }) }]
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings: { siteSearch: 'on', siteBaseUrl: 'https://example.com/' } }, media)).arrayBuffer())
    expect(zip.file('community/news.html')).toBeNull()
    expect(zip.file('assets/draft.png')).toBeNull()
    expect(await zip.file('index.html')!.async('string')).not.toContain('community/news.html')
    expect(await zip.file('search.html')!.async('string')).not.toContain('Private draft')
    expect(await zip.file('search.html')!.async('string')).not.toContain('secret tag')
    expect(await zip.file('search.html')!.async('string')).toContain('News & events')
    expect(await zip.file('sitemap.xml')!.async('string')).not.toContain('community/news.html')
    expect(await zip.file('sitemap.xml')!.async('string')).toContain('https://example.com/articles/index.html')
    const article = await zip.file('about.html')!.async('string')
    expect(article).toContain('By Ada')
    expect(article).toContain('Public article')
    expect(article).toContain('Tags: News &amp; events')
    const archive = await zip.file('articles/index.html')!.async('string')
    expect(archive).toContain('href="../about.html"')
    expect(archive).toContain('rel="canonical" href="https://example.com/articles/index.html"')
    expect(archive).not.toContain('Private draft')
    expect(archive).toContain('Tags: News &amp; events')
    const feed = await zip.file('feed.xml')!.async('string')
    expect(feed).toContain('<link>https://example.com/about.html</link>')
    expect(feed).toContain('<description>Public article</description>')
    expect(feed).toContain('<category>News &amp; events</category>')
    expect(feed).not.toContain('secret tag')
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

  it('provides keyboard skip links and reduced motion support on every generated page', async () => {
    const site = structuredClone(config)
    site.pages![2].webstudioArticle = { status: 'ready', author: '', summary: '', createdAt: '', modifiedAt: '' }
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings: { siteSearch: 'on' } })).arrayBuffer())
    for (const path of ['index.html', 'community/news.html', 'articles/index.html', 'search.html']) {
      const html = await zip.file(path)!.async('string')
      expect(html).toContain('href="#main-content">Skip to main content</a>')
      expect(html).toContain('<main id="main-content" tabindex="-1"')
      expect(html.indexOf('Skip to main content')).toBeLessThan(html.indexOf('aria-label="Site pages"'))
      expect(html).toContain('prefers-reduced-motion: reduce')
    }
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
