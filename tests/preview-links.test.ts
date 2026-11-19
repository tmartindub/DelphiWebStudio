import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeroBlock } from '../src/blocks/hero/HeroBlock'
import { CtaBlock } from '../src/blocks/cta/CtaBlock'
import { NavbarBlock } from '../src/blocks/navbar/NavbarBlock'
import { FooterBlock } from '../src/blocks/footer/FooterBlock'
import { TeamBlock } from '../src/blocks/team/TeamBlock'
import { ContentBlock } from '../src/blocks/content/ContentBlock'
import { exportToHTML } from '../src/lib/export-html'
import type { BlockConfig } from '../src/blocks/types'

describe('preview link and image fidelity', () => {
  it('renders safe text links without turning unsafe protocols into links', async () => {
    const block: BlockConfig = { id: 'text', type: 'content', variant: 'prose', props: { body: '[News](/news) [Site](https://example.com) [Bad](javascript:alert)' } }
    const preview = renderToStaticMarkup(createElement(ContentBlock, { block }))
    expect(preview).toContain('href="/news"')
    expect(preview).toContain('href="https://example.com"')
    expect(preview).not.toContain('href="javascript:')
    expect(await exportToHTML({ name: 'Site', blocks: [block] })).not.toContain('href="javascript:')
  })
  it('shows selected team photos in both preview and exported pages', async () => {
    const block: BlockConfig = { id: 'team', type: 'team', variant: 'grid', props: { members: [{ name: 'Alex', role: 'Volunteer', avatar: 'assets/alex.png' }] } }
    expect(renderToStaticMarkup(createElement(TeamBlock, { block }))).toContain('src="assets/alex.png"')
    expect(await exportToHTML({ name: 'Site', blocks: [block] })).toContain('src="assets/alex.png"')
  })

  it('does not invent team members when none have been added', async () => {
    const block: BlockConfig = { id: 'team', type: 'team', variant: 'grid', props: {} }
    expect(renderToStaticMarkup(createElement(TeamBlock, { block }))).not.toContain('Alex Rivera')
    expect(await exportToHTML({ name: 'Site', blocks: [block] })).not.toContain('Alex Rivera')
  })
  it.each(['centered', 'split', 'gradient', 'minimal'])('renders the configured hero link in %s', variant => {
    const block: BlockConfig = { id: 'hero', type: 'hero', variant, props: { headline: 'Welcome', subheadline: 'Hello', primaryCta: 'Read news', primaryCtaUrl: '/news' } }
    expect(renderToStaticMarkup(createElement(HeroBlock, { block }))).toContain('href="/news"')
  })

  it('shows the configured image in the split hero preview', () => {
    const block: BlockConfig = { id: 'hero', type: 'hero', variant: 'split', props: { headline: 'Welcome', subheadline: '', primaryCta: '', heroImage: 'assets/hero.png' } }
    expect(renderToStaticMarkup(createElement(HeroBlock, { block }))).toContain('src="assets/hero.png"')
  })

  it.each(['simple', 'split'])('renders the configured CTA link in %s', variant => {
    const block: BlockConfig = { id: 'cta', type: 'cta', variant, props: { headline: 'Hello', buttonText: 'Contact', buttonUrl: '/contact' } }
    expect(renderToStaticMarkup(createElement(CtaBlock, { block }))).toContain('href="/contact"')
  })

  it.each(['default', 'centered'])('shows the selected navbar logo in %s', variant => {
    const block: BlockConfig = { id: 'nav', type: 'navbar', variant, props: { logo: 'Community', logoImage: 'assets/logo.png', links: [], ctaText: '' } }
    expect(renderToStaticMarkup(createElement(NavbarBlock, { block }))).toContain('src="assets/logo.png"')
  })

  it('exports the centered navbar layout and omits empty controls', async () => {
    const block: BlockConfig = { id: 'nav', type: 'navbar', variant: 'centered', props: { logo: 'Community', logoImage: 'assets/logo.png', links: ['First', 'Second'], ctaText: '' } }
    const html = await exportToHTML({ name: 'Site', blocks: [block] })
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))
    expect(nav.indexOf('First')).toBeLessThan(nav.indexOf('Community'))
    expect(nav.indexOf('Community')).toBeLessThan(nav.indexOf('Second'))
    expect(nav).toContain('@2xl:flex')
    expect(nav).not.toContain('Get Started')
    block.props.links = []
    expect(renderToStaticMarkup(createElement(NavbarBlock, { block }))).not.toContain('<button')
    const emptyHtml = await exportToHTML({ name: 'Site', blocks: [block] })
    expect(emptyHtml.slice(emptyHtml.indexOf('<nav'), emptyHtml.indexOf('</nav>'))).not.toContain('<button')
  })

  it.each(['default', 'centered'])('does not invent a navbar button when its text is absent in %s', async variant => {
    const block: BlockConfig = { id: 'nav', type: 'navbar', variant, props: { logo: 'Community', links: [] } }
    const html = await exportToHTML({ name: 'Site', blocks: [block] })
    expect(html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))).not.toContain('<button')
  })

  it.each(['default', 'centered'])('uses the configured navbar button destination in preview and export in %s', async variant => {
    const block: BlockConfig = { id: 'nav', type: 'navbar', variant, props: { logo: 'Community', links: [], ctaText: 'Contact', ctaUrl: '/contact' } }
    expect(renderToStaticMarkup(createElement(NavbarBlock, { block }))).toContain('href="/contact"')
    expect(await exportToHTML({ name: 'Site', blocks: [block] })).toContain('href="/contact"')
    delete block.props.ctaUrl
    expect(await exportToHTML({ name: 'Site', blocks: [block] })).not.toContain('href="/contact"')
  })

  it('renders only supplied multi-column footer content in preview and export', async () => {
    const block: BlockConfig = { id: 'footer', type: 'footer', variant: 'multi-column', props: { logo: 'Community', copyright: '', links: [] } }
    const render = () => renderToStaticMarkup(createElement(FooterBlock, { block }))
    const exportPage = () => exportToHTML({ name: 'Community', blocks: [block] })
    expect(render()).not.toContain('Pricing')
    expect(await exportPage()).not.toContain('Build beautiful websites with structured JSON config.')
    block.props.description = 'Neighbors welcome'
    block.props.columns = [{ title: 'Our group', links: ['Meetings'] }]
    expect(render()).toContain('Neighbors welcome')
    expect(render()).toContain('Meetings')
    expect(await exportPage()).toContain('Neighbors welcome')
    expect(await exportPage()).toContain('Meetings')
  })
})
