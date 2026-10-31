import { describe, it, expect } from 'vitest'
import { exportSiteToHTML } from '../src/lib/export-html'
import type { SiteConfig } from '../src/blocks/types'

const baseConfig: SiteConfig = {
  name: 'Test Site',
  blocks: [
    {
      id: 'hero-1',
      type: 'hero',
      variant: 'centered',
      props: {
        headline: 'Hello',
        subheadline: 'World',
        primaryCta: 'Start',
      },
    },
  ],
}

describe('exportSiteToHTML', () => {
  it('exports responsive visibility without removing the section content', () => {
    const html = exportSiteToHTML({ ...baseConfig, blocks: [{ ...baseConfig.blocks[0], webstudioHiddenOn: { mobile: true, desktop: true } }] })
    expect(html).toContain('class="ws-hidden-mobile ws-hidden-desktop"')
    expect(html).toContain('@media (max-width: 479px) { .ws-hidden-mobile { display: none !important; } }')
    expect(html).toContain('@media (min-width: 900px) { .ws-hidden-desktop { display: none !important; } }')
    expect(html).toContain('Hello')
  })
  it('renders unsafe button destinations as text while retaining supported links', () => {
    const hero = baseConfig.blocks[0]
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,test', '//evil.example', '/\\evil.example', 'java\nscript:alert(1)']) {
      const html = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, props: { ...hero.props, primaryCtaUrl: url } }] })
      expect(html).not.toContain(`href="${url}"`)
      expect(html).toMatch(/<span[^>]*>Start<\/span>/)
    }
    for (const url of ['/about', '#section', 'https://example.com', 'mailto:info@example.com', 'tel:+123456']) {
      const html = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, props: { ...hero.props, primaryCtaUrl: url } }] })
      expect(html).toContain(`href="${url}"`)
    }
  })
  it('includes SEO metadata and language settings', () => {
    const html = exportSiteToHTML(baseConfig, {
      settings: {
        siteName: 'OpenPage',
        seoTitle: 'OpenPage Builder',
        seoDescription: 'Build <fast> websites safely',
        ogImageUrl: 'https://cdn.example.com/og.png',
        faviconUrl: 'https://cdn.example.com/favicon.ico',
        language: 'German',
      },
    })

    expect(html).toMatch(/<html lang="de">/)
    expect(html).toMatch(/<title>OpenPage Builder<\/title>/)
    expect(html).toMatch(/name="description" content="Build &lt;fast&gt; websites safely"/)
    expect(html).toMatch(/property="og:image" content="https:\/\/cdn\.example\.com\/og\.png"/)
    expect(html).toMatch(/rel="icon" href="https:\/\/cdn\.example\.com\/favicon\.ico"/)
  })

  it('injects analytics snippets when keys are provided', () => {
    const html = exportSiteToHTML(baseConfig, {
      settings: {
        gaId: 'G-ABC123XYZ',
        posthogKey: 'phc_test_key',
      },
    })

    expect(html).toMatch(/googletagmanager\.com\/gtag\/js\?id=G-ABC123XYZ/)
    expect(html).toMatch(/gtag\('config', "G-ABC123XYZ"\);/)
    expect(html).toMatch(/posthog\.init\("phc_test_key"/)
  })

  it('keeps analytics values inside their script strings', () => {
    const attack = '</script><script>window.injected = true</script>'
    const html = exportSiteToHTML(baseConfig, { settings: { gaId: attack, posthogKey: attack } })
    expect(html).not.toContain(attack)
    expect(html).toContain('\\u003c/script>\\u003cscript>window.injected = true\\u003c/script>')
  })

  it('omits optional metadata when settings are absent', () => {
    const html = exportSiteToHTML(baseConfig)
    expect(html).not.toMatch(/name="description"/)
    expect(html).not.toMatch(/property="og:image"/)
    expect(html).not.toMatch(/googletagmanager/)
    expect(html).not.toMatch(/posthog\.init/)
  })

  it('uses the editor root size and container breakpoints for a centered hero', () => {
    const html = exportSiteToHTML(baseConfig)
    expect(html).toContain('html { font-size: 14px; }')
    expect(html).toContain('overflow-wrap: anywhere;')
    expect(html).toContain('class="@container"')
    expect(html).toContain('@md:text-5xl')
    expect(html).toContain('@md:py-28')
  })

  it('exports all hero layouts with their responsive container breakpoints', () => {
    const hero = baseConfig.blocks[0]
    const split = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, variant: 'split' }] })
    const gradient = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, variant: 'gradient' }] })
    const minimal = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, variant: 'minimal', props: { ...hero.props, primaryCtaUrl: '/about' } }] })
    expect(split).toContain('@2xl:flex-row')
    expect(split).toContain('@md:text-5xl')
    expect(gradient).toContain('@md:py-32')
    expect(minimal).toContain('@md:text-7xl')
    expect(minimal).toContain('href="/about"')
  })

  it('clearly disables forms that have no submission backend', () => {
    const html = exportSiteToHTML({ name: 'Forms', blocks: [
      { id: 'contact', type: 'contact', variant: 'default', props: {} },
      { id: 'newsletter', type: 'newsletter', variant: 'default', props: {} },
    ] })
    expect(html.match(/<fieldset disabled/g)).toHaveLength(2)
    expect(html.match(/This form is not connected yet\./g)).toHaveLength(2)
    expect(html).not.toContain('Join 2,000+ developers and designers')
  })

  it('offers a mail application action only for a valid contact address', () => {
    const contact = { id: 'contact', type: 'contact' as const, variant: 'form', props: { title: 'Contact', recipientEmail: 'office@example.com' } }
    const configured = exportSiteToHTML({ name: 'Forms', blocks: [contact] })
    expect(configured).toContain('data-contact-email="office@example.com"')
    expect(configured).toContain('name="message" required')
    expect(configured).toContain('name="email" required')
    expect(configured).toContain('you send the message there')
    expect(configured).toContain("'mailto:' + recipient")
    const invalid = exportSiteToHTML({ name: 'Forms', blocks: [{ ...contact, props: { ...contact.props, recipientEmail: 'office@example.com?bcc=other@example.com' } }] })
    expect(invalid).not.toContain('data-contact-email="office@example.com')
    expect(invalid).toContain('<fieldset disabled')
  })

  it('preserves responsive feature layouts and alternating images', () => {
    const feature = { id: 'features', type: 'features' as const, variant: 'grid', props: { title: 'Features', items: [{ title: 'Photo', description: 'Description', image: 'assets/photo.png' }] } }
    const grid = exportSiteToHTML({ name: 'Test', blocks: [feature] })
    const alternating = exportSiteToHTML({ name: 'Test', blocks: [{ ...feature, variant: 'alternating' }] })
    expect(grid).toContain('@lg:grid-cols-2 @3xl:grid-cols-3')
    expect(alternating).toContain('@lg:flex-row')
    expect(alternating).toContain('src="assets/photo.png"')
    expect(alternating).toContain('alt="Photo"')
  })

  it('preserves CTA and statistics variants and responsive breakpoints', () => {
    const cta = { id: 'cta', type: 'cta' as const, variant: 'split', props: { headline: 'Contact us', buttonText: 'About', buttonUrl: '/about' } }
    const split = exportSiteToHTML({ name: 'Test', blocks: [cta] })
    expect(split).toContain('@lg:flex-row')
    expect(split).toContain('href="/about"')

    const stats = { id: 'stats', type: 'stats' as const, variant: 'counter', props: { items: [{ value: '12', label: 'Members' }] } }
    const counter = exportSiteToHTML({ name: 'Test', blocks: [stats] })
    expect(counter).toContain('@2xl:grid-cols-4')
    expect(counter).toContain('12')
    expect(counter).toContain('Members')
    expect(counter).toContain('bg-green/8')
  })
})
