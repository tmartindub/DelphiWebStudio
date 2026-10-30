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
})
