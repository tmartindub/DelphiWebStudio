import type { SiteConfig, BlockConfig } from '@/blocks/types'
import { resolveTheme } from '@/lib/theme-presets'
import { validateProjectConfig } from '@/project/project-file'
import { RenderBlock } from '@/blocks/registry'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import JSZip from 'jszip'
import type { MediaAsset } from '@/media/media-library'
import pdfViewerHtml from '@/media/viewer.html?raw'
import pdfViewerScript from '@/media/viewer.js?raw'
import pdfLicense from 'pdfjs-dist/LICENSE?raw'
import exportCss from './export.css?inline'

export interface ExportSiteSettings {
  siteName?: string
  siteDescription?: string
  faviconUrl?: string
  language?: string
  seoTitle?: string
  seoDescription?: string
  siteBaseUrl?: string
  siteSearch?: string
  ogImageUrl?: string
  gaId?: string
  posthogKey?: string
}

export interface ExportSiteOptions {
  settings?: ExportSiteSettings
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderLink(text: string, url?: string, className?: string): string {
  const cls = className ? ` class="${escapeHtml(className)}"` : ''
  const escaped = escapeHtml(text)
  const destination = url?.trim() ?? ''
  if (destination && !/[\\\p{Cc}]/u.test(destination) && !destination.startsWith('//') &&
    (!/^[a-z][a-z\d+.-]*:/i.test(destination) || /^(https?:|mailto:|tel:)/i.test(destination))) {
    return `<a href="${escapeHtml(destination)}"${cls}>${escaped}</a>`
  }
  return `<span${cls}>${escaped}</span>`
}

function initials(name: string): string {
  return escapeHtml(
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
  )
}

function prop<T>(props: Record<string, unknown>, key: string, fallback: T): T {
  const val = props[key]
  if (val === undefined || val === null) return fallback
  return val as T
}

function normalizeLanguage(value?: string): string {
  const normalized = (value || '').toLowerCase().trim()
  if (!normalized) return 'en'
  if (normalized === 'english' || normalized.startsWith('en')) return 'en'
  if (normalized === 'german' || normalized.startsWith('de')) return 'de'
  if (normalized === 'spanish' || normalized.startsWith('es')) return 'es'
  if (normalized === 'french' || normalized.startsWith('fr')) return 'fr'
  return 'en'
}

// ---------------------------------------------------------------------------
// SVG icons (inline, no dependencies)
// ---------------------------------------------------------------------------

const SVG_CHECK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'

const SVG_CHEVRON_DOWN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'

const SVG_MENU =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>'

const SVG_SPARKLES =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>'

const SVG_STAR_FILLED =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'

const SVG_STAR_EMPTY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'

const SVG_QUOTE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3"/></svg>'

const SVG_SEND =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'

const SVG_MAIL =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'

const SVG_STAR_10 =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'

/** Simple icon placeholder for feature items (rounded square with initial) */
function featureIconSvg(iconName: string): string {
  const char = escapeHtml(iconName.charAt(0).toUpperCase())
  return `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/><text x="9" y="13" text-anchor="middle" fill="currentColor" font-size="10" font-weight="600" font-family="system-ui, sans-serif">${char}</text></svg>`
}

function starRatingHtml(rating: number): string {
  const stars = [1, 2, 3, 4, 5]
    .map((i) =>
      i <= rating
        ? `<span class="text-yellow-400">${SVG_STAR_FILLED}</span>`
        : `<span class="text-text-3">${SVG_STAR_EMPTY}</span>`
    )
    .join('')
  return `<div class="flex gap-0.5">${stars}</div>`
}

function logoPlaceholderSvg(name: string): string {
  const char = escapeHtml(name.charAt(0).toUpperCase())
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="26" height="26" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="14" y="18" text-anchor="middle" fill="currentColor" font-size="14" font-weight="700" font-family="system-ui, sans-serif">${char}</text></svg>`
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function renderNavbar(block: BlockConfig): string {
  const logo = escapeHtml(prop(block.props, 'logo', 'Brand'))
  const logoImage = prop<string>(block.props, 'logoImage', '')
  const links = prop<string[]>(block.props, 'links', [])
  const navItems = Array.isArray(block.props.navItems) ? block.props.navItems : []
  const ctaText = prop<string>(block.props, 'ctaText', '')
  const ctaUrl = prop<string>(block.props, 'ctaUrl', '')

  const navLinks = links.map(l =>
    `          <span class="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer">${escapeHtml(l)}</span>`
  )
  const destinationLinks = navItems.filter(item => item && typeof item.label === 'string' && typeof item.url === 'string').map(item =>
    renderLink(item.label, item.url, 'text-[13px] text-text-2 hover:text-text-0 transition-colors')
  )
  const mobileLinks = destinationLinks.length ? `<details class="@2xl:hidden relative"><summary aria-label="Navigation menu" class="w-9 h-9 rounded-lg border border-border-default flex items-center justify-center text-text-2 cursor-pointer">${SVG_MENU}</summary><div class="absolute right-0 z-10 w-56 max-h-[60vh] overflow-y-auto [overflow-wrap:anywhere] p-3 bg-bg-1 border border-border-default rounded-lg flex flex-col gap-3">${destinationLinks.join('\n')}</div></details>` : ''

  const logoHtml = logoImage
    ? `<img src="${escapeHtml(logoImage)}" alt="${logo}" class="h-8 w-auto max-w-[96px] shrink-0 object-contain" />`
    : `<div class="w-8 h-8 shrink-0 rounded-lg bg-green/10 flex items-center justify-center"><div class="w-4 h-4 rounded-full bg-green"></div></div>`

  if (block.variant === 'centered') {
    const mid = Math.ceil(navLinks.length / 2)
    return `  <nav class="px-6 @md:px-10 py-4 flex flex-wrap gap-3 items-center justify-between">
    <div class="hidden @2xl:flex flex-wrap items-center gap-6 flex-1">${navLinks.slice(0, mid).join('\n')}</div>
    <div class="flex min-w-0 items-center gap-2">${logoHtml}<span class="min-w-0 font-semibold text-[15px] text-text-0 tracking-tight">${logo}</span></div>
    <div class="hidden @2xl:flex flex-wrap items-center gap-6 flex-1 justify-end">${navLinks.slice(mid).join('\n')}${destinationLinks.join('\n')}
      ${ctaText ? renderLink(ctaText, ctaUrl, 'px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold hover:bg-green-dim transition-colors ml-2') : ''}
    </div>
    ${ctaText ? renderLink(ctaText, ctaUrl, '@2xl:hidden px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold') : ''}
    ${mobileLinks}
  </nav>`
  }

  return `  <nav class="px-6 @md:px-10 py-4 flex flex-wrap gap-3 items-center justify-between">
    <div class="flex min-w-0 items-center gap-2">
      ${logoHtml}
      <span class="min-w-0 font-semibold text-[15px] text-text-0 tracking-tight">${logo}</span>
    </div>
    <div class="hidden @2xl:flex flex-wrap items-center gap-6">
${navLinks.join('\n')}
${destinationLinks.join('\n')}
    </div>
    <div class="flex items-center gap-3">
      ${ctaText ? renderLink(ctaText, ctaUrl, 'px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold hover:bg-green-dim transition-colors') : ''}
      ${mobileLinks}
    </div>
  </nav>`
}

// ---------------------------------------------------------------------------
// Hero variants
// ---------------------------------------------------------------------------

function renderHeroCentered(block: BlockConfig): string {
  const badge = prop<string>(block.props, 'badge', '')
  const headline = escapeHtml(prop(block.props, 'headline', ''))
  const subheadline = escapeHtml(prop(block.props, 'subheadline', ''))
  const primaryCta = prop<string>(block.props, 'primaryCta', '')
  const primaryCtaUrl = prop<string>(block.props, 'primaryCtaUrl', '')
  const secondaryCta = prop<string>(block.props, 'secondaryCta', '')
  const secondaryCtaUrl = prop<string>(block.props, 'secondaryCtaUrl', '')

  const badgeHtml = badge
    ? `      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green/10 border border-green/20 text-green text-[11px] font-medium mb-6">
        ${SVG_SPARKLES}
        ${escapeHtml(badge)}
      </div>`
    : ''

  const secondaryHtml = secondaryCta
    ? `        ${renderLink(secondaryCta, secondaryCtaUrl, 'px-6 py-3 rounded-lg bg-bg-3 text-text-0 text-sm font-medium border border-border-default hover:bg-bg-4 hover:border-border-hover transition-all inline-block')}`
    : ''

  return `  <section class="px-6 @md:px-10 py-20 @md:py-28 text-center">
${badgeHtml}
      <h1 class="text-4xl @md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 max-w-3xl mx-auto">${headline}</h1>
      <p class="text-text-2 text-base @md:text-lg leading-relaxed max-w-xl mx-auto mb-8">${subheadline}</p>
      <div class="flex flex-wrap items-center justify-center gap-3">
        ${renderLink(primaryCta, primaryCtaUrl, 'px-6 py-3 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all inline-flex items-center gap-2')}
${secondaryHtml}
      </div>
  </section>`
}

function renderHeroSplit(block: BlockConfig): string {
  const badge = prop<string>(block.props, 'badge', '')
  const headline = escapeHtml(prop(block.props, 'headline', ''))
  const subheadline = escapeHtml(prop(block.props, 'subheadline', ''))
  const primaryCta = prop<string>(block.props, 'primaryCta', '')
  const primaryCtaUrl = prop<string>(block.props, 'primaryCtaUrl', '')
  const secondaryCta = prop<string>(block.props, 'secondaryCta', '')
  const secondaryCtaUrl = prop<string>(block.props, 'secondaryCtaUrl', '')
  const heroImage = prop<string>(block.props, 'heroImage', '')

  const badgeHtml = badge
    ? `        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green/10 border border-green/20 text-green text-[11px] font-medium mb-4">
          ${SVG_SPARKLES}
          ${escapeHtml(badge)}
        </div>`
    : ''

  const secondaryHtml = secondaryCta
    ? `          ${renderLink(secondaryCta, secondaryCtaUrl, 'px-6 py-3 rounded-lg bg-bg-3 text-text-0 text-sm font-medium border border-border-default hover:bg-bg-4 transition-all inline-block')}`
    : ''

  const imageHtml = heroImage
    ? `          <img src="${escapeHtml(heroImage)}" alt="" class="absolute inset-0 w-full h-full object-cover" />`
    : `          <div class="absolute inset-0 bg-gradient-to-br from-green/5 to-transparent"></div>
          <div class="absolute inset-6 border border-dashed border-border-default rounded-lg flex items-center justify-center text-text-3 text-sm">Preview</div>`

  return `  <section class="px-6 @md:px-10 py-16 @md:py-24 flex flex-col @2xl:flex-row items-center gap-10">
      <div class="flex-1">
${badgeHtml}
        <h1 class="text-3xl @md:text-5xl font-bold tracking-tight leading-[1.1] mb-4">${headline}</h1>
        <p class="text-text-2 text-base leading-relaxed mb-6 max-w-lg">${subheadline}</p>
        <div class="flex flex-wrap items-center gap-3">
          ${renderLink(primaryCta, primaryCtaUrl, 'px-6 py-3 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all inline-flex items-center gap-2')}
${secondaryHtml}
        </div>
      </div>
      <div class="flex-1 w-full">
        <div class="aspect-[4/3] rounded-xl bg-bg-2 border border-border-default overflow-hidden relative">
${imageHtml}
        </div>
      </div>
  </section>`
}

function renderHeroGradient(block: BlockConfig): string {
  const badge = prop<string>(block.props, 'badge', '')
  const headline = escapeHtml(prop(block.props, 'headline', ''))
  const subheadline = escapeHtml(prop(block.props, 'subheadline', ''))
  const primaryCta = prop<string>(block.props, 'primaryCta', '')
  const primaryCtaUrl = prop<string>(block.props, 'primaryCtaUrl', '')
  const secondaryCta = prop<string>(block.props, 'secondaryCta', '')
  const secondaryCtaUrl = prop<string>(block.props, 'secondaryCtaUrl', '')

  const badgeHtml = badge
    ? `        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green/10 border border-green/20 text-green text-[11px] font-medium mb-6">
          ${SVG_SPARKLES}
          ${escapeHtml(badge)}
        </div>`
    : ''

  const secondaryHtml = secondaryCta
    ? `          ${renderLink(secondaryCta, secondaryCtaUrl, 'px-6 py-3 rounded-lg bg-bg-3 text-text-0 text-sm font-medium border border-border-default hover:bg-bg-4 transition-all inline-block')}`
    : ''

  return `  <section class="px-6 @md:px-10 py-20 @md:py-32 text-center relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-b from-green/5 via-transparent to-transparent pointer-events-none"></div>
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-green/[0.08] rounded-full blur-[100px] pointer-events-none"></div>
      <div class="relative z-10">
${badgeHtml}
        <h1 class="text-4xl @md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 max-w-3xl mx-auto text-text-0">${headline}</h1>
        <p class="text-text-2 text-base @md:text-lg leading-relaxed max-w-xl mx-auto mb-8">${subheadline}</p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          ${renderLink(primaryCta, primaryCtaUrl, 'px-6 py-3 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all inline-flex items-center gap-2')}
${secondaryHtml}
        </div>
      </div>
  </section>`
}

function renderHero(block: BlockConfig): string {
  switch (block.variant) {
    case 'split':
      return renderHeroSplit(block)
    case 'gradient':
      return renderHeroGradient(block)
    case 'minimal': {
      const headline = escapeHtml(prop(block.props, 'headline', ''))
      const subheadline = escapeHtml(prop(block.props, 'subheadline', ''))
      const primaryCta = prop<string>(block.props, 'primaryCta', '')
      const primaryCtaUrl = prop<string>(block.props, 'primaryCtaUrl', '')
      const action = primaryCta ? `<div>${renderLink(primaryCta, primaryCtaUrl, 'px-8 py-4 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all inline-flex items-center gap-2 mx-auto')}</div>` : ''
      return `<section class="px-6 @md:px-10 py-24 @md:py-36 text-center"><h1 class="text-5xl @md:text-7xl font-bold tracking-tighter leading-[1.05] mb-6 max-w-4xl mx-auto">${headline}</h1><p class="text-text-2 text-lg @md:text-xl leading-relaxed max-w-lg mx-auto mb-10">${subheadline}</p>${action}</section>`
    }
    default:
      return renderHeroCentered(block)
  }
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

function renderFeaturesGrid(block: BlockConfig): string {
  const label = prop<string>(block.props, 'label', '')
  const title = escapeHtml(prop(block.props, 'title', ''))
  const subtitle = prop<string>(block.props, 'subtitle', '')
  const items = prop<{ icon?: string; title: string; description: string }[]>(
    block.props,
    'items',
    []
  )

  const labelHtml = label
    ? `        <div class="text-[11px] font-semibold uppercase tracking-widest text-green mb-2">${escapeHtml(label)}</div>`
    : ''
  const subtitleHtml = subtitle
    ? `        <p class="text-text-2 text-sm max-w-lg mx-auto">${escapeHtml(subtitle)}</p>`
    : ''

  const cards = items
    .map(
      (item) => `        <div class="group bg-bg-2 border border-border-default rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:border-border-hover hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
          <div class="w-10 h-10 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center text-green mb-3">
            ${featureIconSvg(item.icon || 'Z')}
          </div>
          <h3 class="text-sm font-semibold mb-1">${escapeHtml(item.title)}</h3>
          <p class="text-[12.5px] text-text-2 leading-relaxed">${escapeHtml(item.description)}</p>
        </div>`
    )
    .join('\n')

  return `  <section class="px-6 @md:px-10 py-16 @md:py-20">
      <div class="text-center mb-10">
${labelHtml}
        <h2 class="text-2xl @md:text-3xl font-bold tracking-tight mb-2">${title}</h2>
${subtitleHtml}
      </div>
      <div class="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-4">
${cards}
      </div>
  </section>`
}

function renderFeaturesList(block: BlockConfig): string {
  const label = prop<string>(block.props, 'label', '')
  const title = escapeHtml(prop(block.props, 'title', ''))
  const subtitle = prop<string>(block.props, 'subtitle', '')
  const items = prop<{ icon?: string; title: string; description: string }[]>(
    block.props,
    'items',
    []
  )

  const labelHtml = label
    ? `        <div class="text-[11px] font-semibold uppercase tracking-widest text-green mb-2">${escapeHtml(label)}</div>`
    : ''
  const subtitleHtml = subtitle
    ? `        <p class="text-text-2 text-sm max-w-lg mx-auto">${escapeHtml(subtitle)}</p>`
    : ''

  const rows = items
    .map(
      (item) => `        <div class="flex gap-4 p-4 rounded-xl bg-bg-2 border border-border-default transition-all hover:border-border-hover">
          <div class="w-10 h-10 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center text-green shrink-0">
            ${featureIconSvg(item.icon || 'Z')}
          </div>
          <div>
            <h3 class="text-sm font-semibold mb-0.5">${escapeHtml(item.title)}</h3>
            <p class="text-[12.5px] text-text-2 leading-relaxed">${escapeHtml(item.description)}</p>
          </div>
        </div>`
    )
    .join('\n')

  return `  <section class="px-6 @md:px-10 py-16 @md:py-20">
      <div class="text-center mb-10">
${labelHtml}
        <h2 class="text-2xl @md:text-3xl font-bold tracking-tight mb-2">${title}</h2>
${subtitleHtml}
      </div>
      <div class="max-w-2xl mx-auto space-y-4">
${rows}
      </div>
  </section>`
}

function renderFeatures(block: BlockConfig): string {
  switch (block.variant) {
    case 'list':
      return renderFeaturesList(block)
    case 'alternating':
      return renderToStaticMarkup(createElement(RenderBlock, { block }))
    default:
      return renderFeaturesGrid(block)
  }
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

interface PricingTier {
  name: string
  price: string
  period?: string
  description?: string
  features: string[]
  cta: string
  featured?: boolean
}

const defaultTiers: PricingTier[] = [
  {
    name: 'Starter',
    price: '$0',
    period: '/month',
    description: 'For personal projects',
    features: ['1 website', '5 blocks', 'Basic export', 'Community support'],
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'For professionals',
    features: [
      'Unlimited websites',
      'All blocks',
      'Custom domains',
      'Priority support',
      'Agent API access',
      'Version history',
    ],
    cta: 'Upgrade to Pro',
    featured: true,
  },
  {
    name: 'Team',
    price: '$49',
    period: '/month',
    description: 'For teams and agencies',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Custom components',
      'SSO',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
  },
]

function renderPricingSimple(block: BlockConfig): string {
  const title = escapeHtml(prop(block.props, 'title', ''))
  const subtitle = prop<string>(block.props, 'subtitle', '')
  const tiers = prop<PricingTier[]>(block.props, 'tiers', defaultTiers)

  const subtitleHtml = subtitle
    ? `        <p class="text-text-2 text-sm max-w-lg mx-auto">${escapeHtml(subtitle)}</p>`
    : ''

  const cards = tiers
    .map((tier) => {
      const featuredBorder = tier.featured
        ? 'bg-bg-2 border-2 border-green'
        : 'bg-bg-2 border border-border-default hover:border-border-hover'
      const featuredBadge = tier.featured
        ? `          <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-green text-black text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            ${SVG_STAR_10}
            Recommended
          </div>`
        : ''
      const btnClass = tier.featured
        ? 'w-full py-2.5 rounded-lg text-sm font-semibold transition-all bg-green text-black hover:bg-green-dim'
        : 'w-full py-2.5 rounded-lg text-sm font-semibold transition-all bg-bg-3 text-text-0 border border-border-default hover:bg-bg-4 hover:border-border-hover'

      const features = tier.features
        .map(
          (f) =>
            `            <li class="flex items-start gap-2 text-[12.5px] text-text-1">
              <span class="text-green shrink-0 mt-0.5">${SVG_CHECK}</span>
              ${escapeHtml(f)}
            </li>`
        )
        .join('\n')

      const periodHtml = tier.period
        ? `<span class="text-text-3 text-sm">${escapeHtml(tier.period)}</span>`
        : ''
      const descHtml = tier.description
        ? `            <p class="text-[11px] text-text-3">${escapeHtml(tier.description)}</p>`
        : ''

      return `        <div class="relative rounded-xl p-6 flex flex-col transition-all ${featuredBorder}">
${featuredBadge}
          <div class="mb-4">
            <h3 class="text-sm font-semibold mb-1">${escapeHtml(tier.name)}</h3>
${descHtml}
          </div>
          <div class="mb-4">
            <span class="text-3xl font-bold tracking-tight">${escapeHtml(tier.price)}</span>
            ${periodHtml}
          </div>
          <ul class="space-y-2 mb-6 flex-1">
${features}
          </ul>
          <button class="${btnClass}">${escapeHtml(tier.cta)}</button>
        </div>`
    })
    .join('\n')

  return `  <section class="px-6 md:px-10 py-16 md:py-20">
      <div class="text-center mb-10">
        <h2 class="text-2xl md:text-3xl font-bold tracking-tight mb-2">${title}</h2>
${subtitleHtml}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
${cards}
      </div>
  </section>`
}

function renderPricingComparison(block: BlockConfig): string {
  const title = escapeHtml(prop(block.props, 'title', ''))
  const subtitle = prop<string>(block.props, 'subtitle', '')
  const tiers = prop<PricingTier[]>(block.props, 'tiers', defaultTiers)

  const allFeatures = [...new Set(tiers.flatMap((t) => t.features))]

  const subtitleHtml = subtitle
    ? `        <p class="text-text-2 text-sm max-w-lg mx-auto">${escapeHtml(subtitle)}</p>`
    : ''

  const headerCells = tiers
    .map((tier) => {
      const cls = tier.featured ? 'text-green' : 'text-text-0'
      return `              <th class="py-3 px-3 text-center font-semibold ${cls}">
                ${escapeHtml(tier.name)}
                <div class="text-lg font-bold mt-0.5">${escapeHtml(tier.price)}</div>
              </th>`
    })
    .join('\n')

  const bodyRows = allFeatures
    .map((feature) => {
      const cells = tiers
        .map((tier) => {
          const has = tier.features.includes(feature)
          return has
            ? `              <td class="py-2.5 px-3 text-center"><span class="text-green inline-block">${SVG_CHECK}</span></td>`
            : `              <td class="py-2.5 px-3 text-center text-text-3">-</td>`
        })
        .join('\n')
      return `            <tr class="border-b border-border-subtle">
              <td class="py-2.5 px-3 text-text-1">${escapeHtml(feature)}</td>
${cells}
            </tr>`
    })
    .join('\n')

  return `  <section class="px-6 md:px-10 py-16 md:py-20">
      <div class="text-center mb-10">
        <h2 class="text-2xl md:text-3xl font-bold tracking-tight mb-2">${title}</h2>
${subtitleHtml}
      </div>
      <div class="max-w-3xl mx-auto overflow-x-auto">
        <table class="w-full text-left text-[12.5px]">
          <thead>
            <tr class="border-b border-border-default">
              <th class="py-3 px-3 text-text-3 font-medium">Feature</th>
${headerCells}
            </tr>
          </thead>
          <tbody>
${bodyRows}
          </tbody>
        </table>
      </div>
  </section>`
}

function renderPricing(block: BlockConfig): string {
  switch (block.variant) {
    case 'comparison':
      return renderPricingComparison(block)
    default:
      return renderPricingSimple(block)
  }
}

// ---------------------------------------------------------------------------
// CTA
// ---------------------------------------------------------------------------

function renderCtaSimple(block: BlockConfig): string {
  const headline = escapeHtml(prop(block.props, 'headline', ''))
  const subheadline = prop<string>(block.props, 'subheadline', '')
  const buttonText = prop<string>(block.props, 'buttonText', '')
  const buttonUrl = prop<string>(block.props, 'buttonUrl', '')

  const subHtml = subheadline
    ? `        <p class="text-text-2 text-sm mb-6 max-w-md mx-auto">${escapeHtml(subheadline)}</p>`
    : ''

  return `  <section class="px-6 @md:px-10 py-16 @md:py-20 text-center relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-b from-green/[0.06] via-green/[0.03] to-transparent pointer-events-none"></div>
      <div class="relative z-10">
        <h2 class="text-2xl @md:text-3xl font-bold tracking-tight mb-3">${headline}</h2>
${subHtml}
        ${renderLink(buttonText, buttonUrl, 'px-8 py-3 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all inline-flex items-center gap-2')}
      </div>
  </section>`
}

function renderCtaSplit(block: BlockConfig): string {
  const headline = escapeHtml(prop(block.props, 'headline', ''))
  const subheadline = prop<string>(block.props, 'subheadline', '')
  const buttonText = prop<string>(block.props, 'buttonText', '')
  const buttonUrl = prop<string>(block.props, 'buttonUrl', '')

  const subHtml = subheadline
    ? `          <p class="text-text-2 text-sm">${escapeHtml(subheadline)}</p>`
    : ''

  return `  <section class="px-6 @md:px-10 py-12 @md:py-16">
      <div class="flex flex-col @lg:flex-row items-center justify-between gap-6 p-8 rounded-xl bg-bg-2 border border-border-default relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-r from-green/5 to-transparent pointer-events-none"></div>
        <div class="relative z-10">
          <h2 class="text-xl @md:text-2xl font-bold tracking-tight mb-1">${headline}</h2>
${subHtml}
        </div>
        ${renderLink(buttonText, buttonUrl, 'relative z-10 px-6 py-3 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all shrink-0 inline-flex items-center gap-2')}
      </div>
  </section>`
}

function renderCta(block: BlockConfig): string {
  switch (block.variant) {
    case 'split':
      return renderCtaSplit(block)
    default:
      return renderCtaSimple(block)
  }
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function renderFooterSimple(block: BlockConfig): string {
  const logo = escapeHtml(prop(block.props, 'logo', 'Brand'))
  const logoImage = prop<string>(block.props, 'logoImage', '')
  const copyright = escapeHtml(prop(block.props, 'copyright', ''))
  const links = prop<string[]>(block.props, 'links', [])

  const linksHtml = links
    .map(
      (l) =>
        `        <span class="text-[12px] text-text-3 hover:text-text-1 transition-colors cursor-pointer">${escapeHtml(l)}</span>`
    )
    .join('\n')

  const footerLogoHtml = logoImage
    ? `<img src="${escapeHtml(logoImage)}" alt="${logo}" class="h-6 w-auto max-w-[96px] shrink-0 object-contain" />`
    : `<div class="w-6 h-6 rounded-md bg-green/10 flex items-center justify-center"><div class="w-3 h-3 rounded-full bg-green"></div></div>`

  return `  <footer class="px-6 @md:px-10 py-8 border-t border-border-subtle">
      <div class="flex flex-col @lg:flex-row items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-2">
          ${footerLogoHtml}
          <span class="min-w-0 text-sm font-semibold text-text-1">${logo}</span>
        </div>
        <div class="flex items-center gap-4">
${linksHtml}
        </div>
        <span class="text-[11px] text-text-3">${copyright}</span>
      </div>
  </footer>`
}

function renderFooterMultiColumn(block: BlockConfig): string {
  const logo = escapeHtml(prop(block.props, 'logo', 'Brand'))
  const logoImage = prop<string>(block.props, 'logoImage', '')
  const description = prop<string>(block.props, 'description', '')
  const copyright = escapeHtml(prop(block.props, 'copyright', ''))
  const links = prop<string[]>(block.props, 'links', [])
  const columns = prop<{ title: string; links: string[] }[]>(
    block.props,
    'columns',
    []
  )

  const colsHtml = columns
    .map((col) => {
      const colLinks = col.links
        .map(
          (l) =>
            `            <li><span class="text-[12.5px] text-text-3 hover:text-text-1 transition-colors cursor-pointer">${escapeHtml(l)}</span></li>`
        )
        .join('\n')
      return `        <div>
          <h4 class="text-[11px] font-semibold uppercase tracking-wider text-text-2 mb-3">${escapeHtml(col.title)}</h4>
          <ul class="space-y-2">
${colLinks}
          </ul>
        </div>`
    })
    .join('\n')

  const bottomLinks = links
    .map(
      (l) =>
        `          <span class="text-[11px] text-text-3 hover:text-text-1 transition-colors cursor-pointer">${escapeHtml(l)}</span>`
    )
    .join('\n')

  const mcLogoHtml = logoImage
    ? `<img src="${escapeHtml(logoImage)}" alt="${logo}" class="h-7 w-auto max-w-[96px] shrink-0 object-contain" />`
    : `<div class="w-7 h-7 rounded-md bg-green/10 flex items-center justify-center"><div class="w-3.5 h-3.5 rounded-full bg-green"></div></div>`

  return `  <footer class="px-6 @md:px-10 py-12 border-t border-border-subtle">
      <div class="grid grid-cols-2 @2xl:grid-cols-5 gap-8 mb-10">
        <div class="col-span-2 @2xl:col-span-1">
          <div class="flex min-w-0 items-center gap-2 mb-3">
            ${mcLogoHtml}
            <span class="min-w-0 text-sm font-semibold">${logo}</span>
          </div>
          ${description ? `<p class="text-[12px] text-text-3 leading-relaxed max-w-[200px]">${escapeHtml(description)}</p>` : ''}
        </div>
${colsHtml}
      </div>
      <div class="pt-6 border-t border-border-subtle flex flex-col @lg:flex-row items-center justify-between gap-3">
        <span class="text-[11px] text-text-3">${copyright}</span>
        <div class="flex gap-4">
${bottomLinks}
        </div>
      </div>
  </footer>`
}

function renderFooterMinimal(block: BlockConfig): string {
  const copyright = escapeHtml(prop(block.props, 'copyright', ''))
  const links = prop<string[]>(block.props, 'links', [])

  const linksHtml = links
    .map((l, i) => {
      const sep = i < links.length - 1 ? '<span class="mx-1">|</span>' : ''
      return `<span class="hover:text-text-1 transition-colors cursor-pointer">${escapeHtml(l)}</span>${sep}`
    })
    .join('')

  const divider = links.length > 0 ? '<span class="mx-1">|</span>' : ''

  return `  <footer class="px-6 @md:px-10 py-6">
      <div class="flex items-center justify-center gap-1.5 text-[11px] text-text-3">
        <span>${copyright}</span>
        ${divider}
        ${linksHtml}
      </div>
  </footer>`
}

function renderFooter(block: BlockConfig): string {
  switch (block.variant) {
    case 'multi-column':
      return renderFooterMultiColumn(block)
    case 'minimal':
      return renderFooterMinimal(block)
    default:
      return renderFooterSimple(block)
  }
}

// ---------------------------------------------------------------------------
// Testimonials (cards only, carousel skipped per spec)
// ---------------------------------------------------------------------------

interface TestimonialItem {
  name: string
  role: string
  quote: string
  rating?: number
  avatar?: string
}

const defaultTestimonials: TestimonialItem[] = [
  {
    name: 'Sarah Chen',
    role: 'CEO at TechCorp',
    quote: 'OpenPage completely changed how we build landing pages. The JSON config approach is genius.',
    rating: 5,
  },
  {
    name: 'Marcus Johnson',
    role: 'Lead Developer',
    quote: 'Finally, a tool where both designers and AI agents can work together seamlessly.',
    rating: 5,
  },
  {
    name: 'Emma Wilson',
    role: 'Product Manager',
    quote: 'We shipped our marketing site in half the time. The component library is incredible.',
    rating: 4,
  },
]

function renderTestimonials(block: BlockConfig): string {
  const title = escapeHtml(
    prop(block.props, 'title', 'What people say')
  )
  const subtitle = prop<string>(block.props, 'subtitle', '')
  const items = prop<TestimonialItem[]>(block.props, 'items', defaultTestimonials)

  const subtitleHtml = subtitle
    ? `        <p class="text-text-2 text-sm max-w-lg mx-auto">${escapeHtml(subtitle)}</p>`
    : ''

  const cards = items
    .map((item) => {
      const ratingHtml = item.rating ? `          ${starRatingHtml(item.rating)}` : ''
      return `        <div class="bg-bg-2 border border-border-default rounded-xl p-5 transition-all hover:border-border-hover">
          <span class="text-green/30 block mb-3">${SVG_QUOTE}</span>
          <p class="text-[13px] text-text-1 leading-relaxed mb-4 italic">"${escapeHtml(item.quote)}"</p>
${ratingHtml}
          <div class="flex items-center gap-3 mt-4 pt-4 border-t border-border-subtle">
            ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name)}" class="w-9 h-9 rounded-full object-cover border border-border-default" />` : `<div class="w-9 h-9 rounded-full bg-bg-4 border border-border-default flex items-center justify-center text-[11px] font-semibold text-text-2">${initials(item.name)}</div>`}
            <div>
              <div class="text-[12.5px] font-semibold">${escapeHtml(item.name)}</div>
              <div class="text-[11px] text-text-3">${escapeHtml(item.role)}</div>
            </div>
          </div>
        </div>`
    })
    .join('\n')

  return `  <section class="px-6 md:px-10 py-16 md:py-20">
      <div class="text-center mb-10">
        <h2 class="text-2xl md:text-3xl font-bold tracking-tight mb-2">${title}</h2>
${subtitleHtml}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
${cards}
      </div>
  </section>`
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

interface StatItem {
  value: string
  label: string
}

const defaultStats: StatItem[] = [
  { value: '10K+', label: 'Sites built' },
  { value: '99.9%', label: 'Uptime' },
  { value: '50ms', label: 'Avg. response' },
  { value: '4.9/5', label: 'User rating' },
]

function renderStatsGrid(block: BlockConfig): string {
  const title = prop<string>(block.props, 'title', '')
  const items = prop<StatItem[]>(block.props, 'items', defaultStats)

  const titleHtml = title
    ? `      <h2 class="text-xl font-bold tracking-tight text-center mb-8">${escapeHtml(title)}</h2>`
    : ''

  const cards = items
    .map(
      (item) => `        <div class="text-center p-4 rounded-xl bg-bg-2 border border-border-default">
          <div class="text-3xl @md:text-4xl font-bold tracking-tight text-green mb-1">${escapeHtml(item.value)}</div>
          <div class="text-[12px] text-text-2 font-medium">${escapeHtml(item.label)}</div>
        </div>`
    )
    .join('\n')

  return `  <section class="px-6 @md:px-10 py-12 @md:py-16">
${titleHtml}
      <div class="grid grid-cols-2 @2xl:grid-cols-4 gap-4">
${cards}
      </div>
  </section>`
}

function renderStatsBar(block: BlockConfig): string {
  const items = prop<StatItem[]>(block.props, 'items', defaultStats)

  const statsHtml = items
    .map(
      (item) => `          <div class="text-center">
            <div class="text-2xl @md:text-3xl font-bold tracking-tight text-text-0 mb-0.5">${escapeHtml(item.value)}</div>
            <div class="text-[11px] text-text-3 font-medium uppercase tracking-wider">${escapeHtml(item.label)}</div>
          </div>`
    )
    .join('\n')

  return `  <section class="px-6 @md:px-10 py-10">
      <div class="flex flex-wrap items-center justify-center gap-8 @md:gap-12 py-6 px-4 rounded-xl bg-bg-2 border border-border-default">
${statsHtml}
      </div>
  </section>`
}

function renderStats(block: BlockConfig): string {
  switch (block.variant) {
    case 'bar':
      return renderStatsBar(block)
    case 'counter':
      return renderToStaticMarkup(createElement(RenderBlock, { block }))
    default:
      return renderStatsGrid(block)
  }
}

// ---------------------------------------------------------------------------
// FAQ (with inline JS for accordion toggle)
// ---------------------------------------------------------------------------

interface FaqItem {
  question: string
  answer: string
}

const defaultFaqs: FaqItem[] = [
  {
    question: 'What is OpenPage?',
    answer:
      'OpenPage is a visual website builder that uses structured JSON config as the source of truth. Both humans and AI agents can edit the same config to build beautiful websites.',
  },
  {
    question: 'How does the JSON config work?',
    answer:
      'Every website is represented as a JSON document with blocks, styles, and content. The visual editor reads and writes this JSON, and agents can make surgical edits via the API.',
  },
  {
    question: 'Can I use my own components?',
    answer:
      'Yes! OpenPage supports custom components. You can build your own blocks following our component schema and register them in the block registry.',
  },
  {
    question: 'Is it free to use?',
    answer:
      'OpenPage offers a free tier for personal projects with up to 5 blocks. Pro and Team plans unlock unlimited blocks, custom domains, and priority support.',
  },
]

function renderFaq(block: BlockConfig): string {
  const title = escapeHtml(
    prop(block.props, 'title', 'Frequently Asked Questions')
  )
  const subtitle = prop<string>(block.props, 'subtitle', '')
  const items = prop<FaqItem[]>(block.props, 'items', defaultFaqs)

  const subtitleHtml = subtitle
    ? `        <p class="text-text-2 text-sm max-w-lg mx-auto">${escapeHtml(subtitle)}</p>`
    : ''

  const accordionItems = items
    .map(
      (item, i) => `        <div class="border-b border-border-subtle">
          <button onclick="toggleFaq(this)" class="w-full flex items-center justify-between py-4 text-left group" aria-expanded="${i === 0 ? 'true' : 'false'}">
            <span class="text-[13.5px] font-medium text-text-0 group-hover:text-green transition-colors">${escapeHtml(item.question)}</span>
            <span class="faq-chevron text-text-3 shrink-0 ml-4 transition-transform duration-200${i === 0 ? ' rotate-180 text-green' : ''}">${SVG_CHEVRON_DOWN}</span>
          </button>
          <div class="faq-content overflow-hidden transition-all duration-200${i === 0 ? ' max-h-[500px] pb-4' : ' max-h-0'}">
            <p class="text-[12.5px] text-text-2 leading-relaxed pr-8">${escapeHtml(item.answer)}</p>
          </div>
        </div>`
    )
    .join('\n')

  return `  <section class="px-6 md:px-10 py-16 md:py-20">
      <div class="text-center mb-10">
        <h2 class="text-2xl md:text-3xl font-bold tracking-tight mb-2">${title}</h2>
${subtitleHtml}
      </div>
      <div class="max-w-2xl mx-auto">
${accordionItems}
      </div>
  </section>`
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

interface TeamMember {
  name: string
  role: string
  avatar?: string
}

function renderTeam(block: BlockConfig): string {
  const title = escapeHtml(prop(block.props, 'title', 'Meet the Team'))
  const subtitle = prop<string>(block.props, 'subtitle', '')
  const members = prop<TeamMember[]>(block.props, 'members', [])

  const subtitleHtml = subtitle
    ? `        <p class="text-text-2 text-sm max-w-lg mx-auto">${escapeHtml(subtitle)}</p>`
    : ''

  const cards = members
    .map(
      (m) => `        <div class="text-center group">
          ${m.avatar ? `<img src="${escapeHtml(m.avatar)}" alt="${escapeHtml(m.name)}" class="w-20 h-20 mx-auto rounded-full object-cover border-2 border-border-default mb-3 transition-all group-hover:border-green/30" />` : `<div class="w-20 h-20 mx-auto rounded-full bg-bg-3 border-2 border-border-default flex items-center justify-center text-xl font-bold text-text-3 mb-3 transition-all group-hover:border-green/30">${initials(m.name)}</div>`}
          <h3 class="text-sm font-semibold">${escapeHtml(m.name)}</h3>
          <p class="text-[11px] text-text-3 mt-0.5">${escapeHtml(m.role)}</p>
        </div>`
    )
    .join('\n')

  return `  <section class="px-6 md:px-10 py-16 md:py-20">
      <div class="text-center mb-10">
        <h2 class="text-2xl md:text-3xl font-bold tracking-tight mb-2">${title}</h2>
${subtitleHtml}
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
${cards}
      </div>
  </section>`
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

function renderContact(block: BlockConfig): string {
  const title = escapeHtml(prop(block.props, 'title', 'Get in Touch'))
  const subtitle = prop<string>(block.props, 'subtitle', '')
  const recipient = typeof block.props.recipientEmail === 'string' ? block.props.recipientEmail.trim() : ''
  const configured = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(recipient)

  const subtitleHtml = subtitle
    ? `          <p class="text-text-2 text-sm">${escapeHtml(subtitle)}</p>`
    : ''

  return `  <section class="px-6 @md:px-10 py-16 @md:py-20">
      <div class="max-w-lg mx-auto">
        <div class="text-center mb-8">
          <h2 class="text-2xl @md:text-3xl font-bold tracking-tight mb-2">${title}</h2>
${subtitleHtml}
        </div>
        <form onsubmit="return false"${configured ? ` data-contact-email="${escapeHtml(recipient)}"` : ''}><fieldset${configured ? '' : ' disabled'} class="space-y-4">
          <div class="grid grid-cols-1 @sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11.5px] text-text-2 mb-1.5 font-medium">Name
              <input type="text" name="name" required maxlength="200" placeholder="Your name" class="w-full px-3 py-2.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 transition-colors" /></label>
            </div>
            <div>
              <label class="block text-[11.5px] text-text-2 mb-1.5 font-medium">Email
              <input type="email" name="email" required maxlength="254" placeholder="you@example.com" class="w-full px-3 py-2.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 transition-colors" /></label>
            </div>
          </div>
          <div>
            <label class="block text-[11.5px] text-text-2 mb-1.5 font-medium">Message
            <textarea name="message" required maxlength="4000" rows="4" placeholder="How can we help?" class="w-full px-3 py-2.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 resize-y transition-colors"></textarea></label>
          </div>
          <button type="submit" class="w-full py-3 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all flex items-center justify-center gap-2">
            ${SVG_SEND}
            Send Message
          </button>
        </fieldset></form>
        <p class="text-text-1 text-sm mt-3">${configured ? 'This form opens your email application; you send the message there.' : 'This form is not connected yet.'}</p>
        ${configured ? '<noscript>JavaScript is required to open the email application from this form.</noscript>' : ''}
      </div>
  </section>`
}

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------

function renderNewsletter(block: BlockConfig): string {
  const title = escapeHtml(
    prop(block.props, 'title', 'Stay in the loop')
  )
  const subtitle = escapeHtml(
    prop(
      block.props,
      'subtitle',
      'Get updates on new features and releases. No spam, ever.'
    )
  )
  const buttonText = escapeHtml(
    prop(block.props, 'buttonText', 'Subscribe')
  )
  const socialProof = prop<string>(block.props, 'socialProof', '')

  const proofText = socialProof ? `<p class="text-[11px] text-text-3 mt-3">${escapeHtml(socialProof)}</p>` : ''

  return `  <section class="px-6 @md:px-10 py-12 @md:py-16">
      <div class="max-w-xl mx-auto text-center">
        <div class="w-12 h-12 rounded-xl bg-green/10 border border-green/20 flex items-center justify-center text-green mx-auto mb-4">
          ${SVG_MAIL}
        </div>
        <h2 class="text-xl @md:text-2xl font-bold tracking-tight mb-2">${title}</h2>
        <p class="text-text-2 text-sm mb-6">${subtitle}</p>
        <form onsubmit="return false"><fieldset disabled class="flex gap-2 max-w-sm mx-auto">
          <input type="email" placeholder="you@example.com" class="min-w-0 flex-1 px-4 py-2.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 transition-colors" />
          <button type="submit" class="px-5 py-2.5 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all shrink-0">${buttonText}</button>
        </fieldset></form>
        <p class="text-text-1 text-sm mt-3">This form is not connected yet.</p>
        ${proofText}
      </div>
  </section>`
}

// ---------------------------------------------------------------------------
// Logo Cloud
// ---------------------------------------------------------------------------

function renderLogoCloud(block: BlockConfig): string {
  const title = escapeHtml(
    prop(block.props, 'title', 'Trusted by teams at')
  )
  const logos = prop<string[]>(block.props, 'logos', [
    'Vercel',
    'Stripe',
    'GitHub',
    'Figma',
    'Notion',
    'Linear',
  ])

  const logosHtml = logos
    .map(
      (name) => `        <div class="group cursor-pointer transition-all">
          <div class="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-all group-hover:scale-105">
            <span class="text-text-3 group-hover:text-green transition-colors">${logoPlaceholderSvg(name)}</span>
            <span class="text-sm font-semibold text-text-3 group-hover:text-text-0 tracking-tight transition-colors">${escapeHtml(name)}</span>
          </div>
        </div>`
    )
    .join('\n')

  return `  <section class="px-6 md:px-10 py-10 md:py-14">
      <p class="text-center text-[11px] font-medium uppercase tracking-widest text-text-3 mb-6">${title}</p>
      <div class="flex flex-wrap items-center justify-center gap-8 md:gap-12">
${logosHtml}
      </div>
  </section>`
}

// ---------------------------------------------------------------------------
// Block dispatcher
// ---------------------------------------------------------------------------

function renderBlock(block: BlockConfig): string {
  switch (block.type) {
    case 'navbar':
      return renderNavbar(block)
    case 'hero':
      return renderHero(block)
    case 'features':
      return renderFeatures(block)
    case 'pricing':
      return renderPricing(block)
    case 'cta':
      return renderCta(block)
    case 'footer':
      return renderFooter(block)
    case 'testimonials':
      return renderTestimonials(block)
    case 'stats':
      return renderStats(block)
    case 'faq':
      return renderFaq(block)
    case 'team':
      return renderTeam(block)
    case 'contact':
      return renderContact(block)
    case 'newsletter':
      return renderNewsletter(block)
    case 'logocloud':
      return renderLogoCloud(block)
    case 'divider':
    case 'banner':
    case 'content':
    case 'image':
    case 'video':
    case 'gallery':
    case 'document':
    case 'audio':
    case 'mediaVideo':
      return renderToStaticMarkup(createElement(RenderBlock, { block }))
    case 'pdfViewer': {
      const src = String(block.props.src || '')
      if (!/^assets\/[a-zA-Z0-9._-]+\.pdf$/i.test(src)) throw new Error('PDF viewer requires a PDF from the media library.')
      const title = escapeHtml(String(block.props.title || 'PDF document'))
      const height = Math.max(200, Math.min(2000, Number(block.props.height) || 600))
      const viewer = `assets/pdfjs/viewer.html?file=${encodeURIComponent(`../${src.slice(7)}`)}`
      return `<section class="p-6"><h2 class="text-xl font-semibold mb-3">${title}</h2><iframe src="${escapeHtml(viewer)}" title="${title}" style="width:100%;height:${height}px;border:0" allowfullscreen></iframe><a href="${escapeHtml(src)}" class="text-green" download>Open or download PDF</a></section>`
    }
    default:
      return `  <!-- Unknown block type: ${escapeHtml(block.type)} -->`
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function exportSiteToHTML(config: SiteConfig, options?: ExportSiteOptions): string {
  const theme = resolveTheme(config.theme)
  const settings = options?.settings

  const hasFaq = config.blocks.some((b) => b.type === 'faq')
  const hasContact = config.blocks.some((b) => b.type === 'contact')

  const blocksHtml = `<main id="main-content" tabindex="-1" class="@container">${config.blocks.map((b) => renderBlock(b)).join('\n\n')}</main>`

  const pageTitle = (settings?.seoTitle || settings?.siteName || config.name || 'Website').trim()
  const pageDescription = (settings?.seoDescription || settings?.siteDescription || '').trim()
  const ogTitle = (settings?.seoTitle || settings?.siteName || pageTitle).trim()
  const ogDescription = (settings?.seoDescription || settings?.siteDescription || pageDescription).trim()
  const ogImage = (settings?.ogImageUrl || '').trim()
  const faviconUrl = (settings?.faviconUrl || '').trim()
  const gaId = (settings?.gaId || '').trim()
  const posthogKey = (settings?.posthogKey || '').trim()
  const lang = normalizeLanguage(settings?.language)

  const descriptionMeta = pageDescription
    ? `  <meta name="description" content="${escapeHtml(pageDescription)}" />\n`
    : ''
  const ogDescriptionMeta = ogDescription
    ? `  <meta property="og:description" content="${escapeHtml(ogDescription)}" />\n`
    : ''
  const ogImageMeta = ogImage
    ? `  <meta property="og:image" content="${escapeHtml(ogImage)}" />\n`
    : ''
  const faviconLink = faviconUrl
    ? `  <link rel="icon" href="${escapeHtml(faviconUrl)}" />\n`
    : ''

  const gaScript = gaId
    ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', ${JSON.stringify(gaId).replace(/</g, '\\u003c')});
  </script>`
    : ''

  const posthogScript = posthogKey
    ? `
  <script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");
    2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}
    (p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",
    (r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",
    u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},
    u.people.toString=function(){return u.toString(1)+".people"},o="init capture register register_once alias unregister identify set_config reset opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing".split(" "),
    n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init(${JSON.stringify(posthogKey).replace(/</g, '\\u003c')}, { api_host: 'https://us.i.posthog.com' });
  </script>`
    : ''

  const faqScript = hasFaq
    ? `
    <script>
      function toggleFaq(btn) {
        var content = btn.nextElementSibling;
        var chevron = btn.querySelector('.faq-chevron');
        var isOpen = btn.getAttribute('aria-expanded') === 'true';

        // Close all
        var items = btn.closest('section').querySelectorAll('[aria-expanded]');
        items.forEach(function(b) {
          b.setAttribute('aria-expanded', 'false');
          b.nextElementSibling.style.maxHeight = '0';
          b.nextElementSibling.style.paddingBottom = '0';
          var c = b.querySelector('.faq-chevron');
          if (c) { c.style.transform = ''; c.classList.remove('text-green'); c.classList.add('text-text-3'); }
        });

        // Toggle current
        if (!isOpen) {
          btn.setAttribute('aria-expanded', 'true');
          content.style.maxHeight = '500px';
          content.style.paddingBottom = '1rem';
          if (chevron) { chevron.style.transform = 'rotate(180deg)'; chevron.classList.add('text-green'); chevron.classList.remove('text-text-3'); }
        }
      }
    </script>`
    : ''

  const contactScript = hasContact
    ? `
    <script>
      document.querySelectorAll('form[data-contact-email]').forEach(function(form) {
        form.addEventListener('submit', function(event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          var data = new FormData(form);
          var body = 'Name: ' + data.get('name') + '\\nEmail: ' + data.get('email') + '\\n\\n' + data.get('message');
          var recipient = encodeURIComponent(form.getAttribute('data-contact-email')).replace('%40', '@');
          window.location.href = 'mailto:' + recipient + '?subject=' + encodeURIComponent('Website message') + '&body=' + encodeURIComponent(body);
        });
      });
    </script>`
    : ''

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageTitle)}</title>
${descriptionMeta}  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
${ogDescriptionMeta}${ogImageMeta}${faviconLink}

  <style>${exportCss}</style>

  <!-- Theme CSS Custom Properties -->
  <style>
    :root {
      --color-bg-0: ${theme.bg0};
      --color-bg-1: ${theme.bg1};
      --color-bg-2: ${theme.bg2};
      --color-bg-3: ${theme.bg3};
      --color-bg-4: ${theme.bg4};
      --color-bg-5: ${theme.bg5};
      --color-text-0: ${theme.text0};
      --color-text-1: ${theme.text1};
      --color-text-2: ${theme.text2};
      --color-text-3: ${theme.text3};
      --color-green: ${theme.accent};
      --color-green-dim: ${theme.accentDim};
      --color-border-default: ${theme.borderDefault};
      --color-border-subtle: ${theme.borderSubtle};
      --color-border-hover: ${theme.borderHover};
      --font-sans: "${theme.fontSans}", -apple-system, system-ui, sans-serif;
      --font-display: "${theme.fontDisplay}", system-ui, sans-serif;
      --font-mono: "${theme.fontMono}", ui-monospace, monospace;
      --radius-default: ${theme.radius}px;
      --radius-lg: ${theme.radiusLg}px;
    }

    html { font-size: 14px; }
    *, *::before, *::after { box-sizing: border-box; }
    .skip-to-content { position: fixed; top: -100px; left: 8px; z-index: 9999; padding: 10px 14px; background: #fff; color: #000; border: 2px solid #000; }
    .skip-to-content:focus { top: 8px; }
    :focus-visible { outline: 3px solid #f28a25; outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }

    body {
      margin: 0;
      overflow-wrap: anywhere;
      background-color: ${theme.bg0};
      color: ${theme.text0};
      font-family: "${theme.fontSans}", -apple-system, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: "${theme.fontDisplay}", system-ui, sans-serif;
    }

    .faq-content {
      transition: max-height 0.2s ease, padding-bottom 0.2s ease;
    }

    .faq-chevron {
      transition: transform 0.2s ease;
    }
  </style>
${gaScript}
${posthogScript}
</head>
<body>
<a class="skip-to-content" href="#main-content">Skip to main content</a>
<!-- WEBSTUDIO_PAGE_NAV -->

${blocksHtml}
${faqScript}
${contactScript}
</body>
</html>`
}

export async function exportToHTML(
  config: SiteConfig,
  options?: ExportSiteOptions
): Promise<string> {
  return exportSiteToHTML(config, options)
}

export async function exportSiteZip(config: SiteConfig, options?: ExportSiteOptions, media: MediaAsset[] = []): Promise<Blob> {
  const validated = validateProjectConfig(config)
  const allPages = validated.pages!
  const pages = allPages.filter(page => page.webstudioArticle?.status !== 'draft')
  const articles = pages.filter(page => page.webstudioArticle?.status === 'ready')
  const knownTypes = new Set(['navbar', 'hero', 'features', 'pricing', 'cta', 'footer', 'testimonials', 'stats', 'faq', 'team', 'contact', 'newsletter', 'logocloud', 'divider', 'banner', 'content', 'image', 'video', 'gallery', 'pdfViewer', 'document', 'audio', 'mediaVideo'])
  for (const page of pages) {
    const unknown = page.blocks.find(block => !knownTypes.has(block.type))
    if (unknown) throw new Error(`Page ${page.name} contains unsupported block ${unknown.type}; it cannot be exported safely.`)
  }
  const paths = pages.map(page => page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`)
  for (const page of pages) {
    if (page.path.split('/').some(segment => /^(com|lpt)[¹²³](?:\.|$)/i.test(segment))) {
      throw new Error(`Page ${page.name} has a Windows-reserved address. Change its page address before exporting.`)
    }
  }
  if (new Set(paths.map(path => path.toLowerCase())).size !== paths.length) throw new Error('Page paths produce duplicate export filenames.')
  if (paths.some((path, index) => paths.some((other, otherIndex) => index !== otherIndex && other.toLowerCase().startsWith(`${path.toLowerCase()}/`)))) {
    throw new Error('Page paths produce conflicting file and folder names.')
  }
  const zip = new JSZip()
  const siteBaseUrl = options?.settings?.siteBaseUrl?.trim()
  let canonicalBase: URL | undefined
  if (siteBaseUrl) {
    let base: URL
    try {
      if (/[\\\p{Cc}\s]/u.test(siteBaseUrl) || !/^https?:\/\//i.test(siteBaseUrl)) throw new Error('Invalid URL')
      base = new URL(siteBaseUrl)
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Invalid URL')
    } catch {
      throw new Error('Public site URL must be an absolute http or https address without credentials, query, or fragment.')
    }
    if (pages.length + (articles.length ? 1 : 0) > 50_000) throw new Error('The site has too many pages for one sitemap.')
    if (!base.pathname.endsWith('/')) base.pathname += '/'
    canonicalBase = base
    const locations = [...paths, ...(articles.length ? ['articles/index.html'] : [])].map(path => `  <url><loc>${escapeHtml(new URL(encodeURI(path), base).href)}</loc></url>`).join('\n')
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations}\n</urlset>\n`
    if (new TextEncoder().encode(sitemap).length > 50 * 1024 * 1024) throw new Error('The sitemap is too large to export.')
    zip.file('sitemap.xml', sitemap, { date: new Date('1980-01-01T00:00:00Z') })
    if (articles.length) {
      const channelTitle = options?.settings?.siteName || validated.name
      const channelDescription = options?.settings?.siteDescription || 'Articles'
      const xmlValues = [channelTitle, channelDescription, ...articles.flatMap(article => [article.name, article.webstudioArticle!.summary, ...(article.webstudioArticle!.tags ?? [])])]
      if (xmlValues.some(value => Array.from(value).some(character => {
        const code = character.codePointAt(0)!
        return (code < 32 && code !== 9 && code !== 10 && code !== 13) || (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff
      }))) throw new Error('Article feed contains characters that cannot be written to XML.')
      const items = articles.map(article => {
        const location = new URL(encodeURI(paths[pages.indexOf(article)]), base).href
        return `  <item><title>${escapeHtml(article.name)}</title><link>${escapeHtml(location)}</link><guid isPermaLink="true">${escapeHtml(location)}</guid><description>${escapeHtml(article.webstudioArticle!.summary)}</description>${(article.webstudioArticle!.tags ?? []).map(tag => `<category>${escapeHtml(tag)}</category>`).join('')}</item>`
      }).join('\n')
      const feed = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${escapeHtml(channelTitle)}</title><link>${escapeHtml(base.href)}</link><description>${escapeHtml(channelDescription)}</description>\n${items}\n</channel></rss>\n`
      zip.file('feed.xml', feed, { date: new Date('1980-01-01T00:00:00Z') })
    }
  }
  if (articles.length) {
    const nav = pages.map((page, index) => `<a href="../${escapeHtml(encodeURI(paths[index]))}" class="min-w-0 [overflow-wrap:anywhere] hover:text-text-0">${escapeHtml(page.name)}</a>`).join(' ')
    const cards = articles.map(article => `<article class="p-4 rounded-lg border border-border-default"><h2 class="text-xl font-semibold"><a href="../${escapeHtml(encodeURI(paths[pages.indexOf(article)]))}" class="text-green hover:underline">${escapeHtml(article.name)}</a></h2>${article.webstudioArticle!.author ? `<p class="text-sm">By ${escapeHtml(article.webstudioArticle!.author)}</p>` : ''}${article.webstudioArticle!.summary ? `<p class="text-sm">${escapeHtml(article.webstudioArticle!.summary)}</p>` : ''}${article.webstudioArticle!.tags?.length ? `<p class="text-sm">Tags: ${article.webstudioArticle!.tags.map(escapeHtml).join(', ')}</p>` : ''}</article>`).join('')
    const content = `<main id="main-content" tabindex="-1" class="@container"><div class="max-w-3xl mx-auto px-6 py-12"><h1 class="text-3xl font-bold mb-4">Articles</h1><div class="space-y-4">${cards}</div>${siteBaseUrl ? '<p class="mt-4"><a href="../feed.xml" class="text-green hover:underline">RSS feed</a></p>' : ''}</div></main>`
    const searchNav = options?.settings?.siteSearch === 'on' ? ' <a href="../search.html" class="min-w-0 [overflow-wrap:anywhere] hover:text-text-0">Search</a>' : ''
    const archive = exportSiteToHTML({ ...validated, name: 'Articles', blocks: [] }, { settings: { ...options?.settings, seoTitle: 'Articles' } })
      .replace('</head>', canonicalBase ? `  <link rel="canonical" href="${escapeHtml(new URL('articles/index.html', canonicalBase).href)}" />\n  <meta property="og:url" content="${escapeHtml(new URL('articles/index.html', canonicalBase).href)}" />\n</head>` : '</head>')
      .replace('<!-- WEBSTUDIO_PAGE_NAV -->', `<nav aria-label="Site pages" class="flex flex-wrap gap-x-4 gap-y-2 px-6 py-3 bg-bg-1 text-text-1">${nav} <a href="index.html" aria-current="page" class="min-w-0 [overflow-wrap:anywhere] hover:text-text-0">Articles</a>${searchNav}</nav>`)
      .replace('<main id="main-content" tabindex="-1" class="@container"></main>', content)
    zip.file('articles/index.html', archive, { date: new Date('1980-01-01T00:00:00Z') })
  }
  if (options?.settings?.siteSearch === 'on') {
    const searchIndex = pages.map((page, pageIndex) => {
      const text: string[] = [page.name, page.webstudioArticle?.author ?? '', page.webstudioArticle?.summary ?? '', ...(page.webstudioArticle?.tags ?? [])]
      const pending: unknown[] = page.blocks.map(block => block.props)
      while (pending.length) {
        const value = pending.pop()
        if (!value || typeof value !== 'object') continue
        for (const [key, child] of Object.entries(value)) {
          if (typeof child === 'string' && /^(title|headline|subtitle|subheadline|body|text|description|question|answer|caption|label|name|alt)$/i.test(key)) text.push(child)
          else if (child && typeof child === 'object') pending.push(child)
        }
      }
      return { title: page.name, href: encodeURI(paths[pageIndex]), text: text.join(' ') }
    })
    const searchData = JSON.stringify(searchIndex).replace(/</g, '\\u003c')
    const nav = pages.map((page, index) => `<a href="${escapeHtml(encodeURI(paths[index]))}" class="min-w-0 [overflow-wrap:anywhere] hover:text-text-0">${escapeHtml(page.name)}</a>`).join(' ') + (articles.length ? ' <a href="articles/index.html" class="min-w-0 [overflow-wrap:anywhere] hover:text-text-0">Articles</a>' : '')
    const searchContent = `<main id="main-content" tabindex="-1" class="@container"><div class="max-w-3xl mx-auto px-6 py-12"><h1 class="text-3xl font-bold mb-4">Search</h1><form id="site-search-form"><label for="site-search-query" class="block mb-2">Search this site</label><input id="site-search-query" type="search" maxlength="200" class="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-2 text-text-0" /><button type="submit" class="mt-3 px-4 py-2 rounded-lg bg-green text-black font-semibold">Search</button></form><p id="site-search-status" role="status" class="mt-4"></p><ul id="site-search-results" class="mt-4 space-y-2"></ul><noscript>JavaScript is required for site search.</noscript></div></main>`
    const searchScript = `<script type="application/json" id="site-search-data">${searchData}</script><script>
      document.getElementById('site-search-form').addEventListener('submit', function(event) {
        event.preventDefault();
        var query = document.getElementById('site-search-query').value.trim().toLocaleLowerCase();
        var results = document.getElementById('site-search-results');
        var status = document.getElementById('site-search-status');
        results.replaceChildren();
        if (!query) { status.textContent = 'Enter a search term.'; return; }
        var words = query.split(/\\s+/);
        var pages = JSON.parse(document.getElementById('site-search-data').textContent);
        var matches = pages.filter(function(page) { var content = page.text.toLocaleLowerCase(); return words.every(function(word) { return content.includes(word); }); });
        status.textContent = matches.length ? matches.length + (matches.length === 1 ? ' page found.' : ' pages found.') : 'No matching pages.';
        matches.forEach(function(page) { var item = document.createElement('li'); var link = document.createElement('a'); link.href = page.href; link.textContent = page.title; link.className = 'text-green hover:underline'; item.appendChild(link); results.appendChild(item); });
      });
    </script>`
    const searchPage = exportSiteToHTML({ ...validated, name: 'Search', blocks: [] }, { settings: { ...options.settings, seoTitle: 'Search' } })
      .replace('</head>', '<meta name="robots" content="noindex" />\n</head>')
      .replace('<!-- WEBSTUDIO_PAGE_NAV -->', `<nav aria-label="Site pages" class="flex flex-wrap gap-x-4 gap-y-2 px-6 py-3 bg-bg-1 text-text-1">${nav} <a href="search.html" aria-current="page" class="min-w-0 [overflow-wrap:anywhere] hover:text-text-0">Search</a></nav>`)
      .replace('<main id="main-content" tabindex="-1" class="@container"></main>', searchContent)
      .replace('</body>', `${searchScript}\n</body>`)
    zip.file('search.html', searchPage, { date: new Date('1980-01-01T00:00:00Z') })
  }
  if (pages.some(page => page.blocks.some(block => block.type === 'pdfViewer'))) {
    const [{ default: pdfModule }, { default: pdfWorker }] = await Promise.all([
      import('pdfjs-dist/build/pdf.min.mjs?raw'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?raw'),
    ])
    const date = new Date('1980-01-01T00:00:00Z')
    zip.file('assets/pdfjs/pdf.min.js', pdfModule, { date })
    zip.file('assets/pdfjs/pdf.worker.min.js', pdfWorker, { date })
    zip.file('assets/pdfjs/viewer.html', pdfViewerHtml, { date })
    zip.file('assets/pdfjs/viewer.js', pdfViewerScript, { date })
    zip.file('assets/pdfjs/LICENSE', pdfLicense, { date })
  }
  const serialized = JSON.stringify(pages)
  const textMediaPaths = pages.flatMap(page => page.blocks.filter(block => block.type === 'content' && typeof block.props.body === 'string').flatMap(block => [...(block.props.body as string).matchAll(/\]\((assets\/[a-zA-Z0-9._-]+)(?:[?#][^)\s]*)?\)/g)].map(match => match[1])))
  const referencedPaths = [...new Set([...serialized.matchAll(/"(assets\/[a-zA-Z0-9._-]+)"/g)].map(match => match[1]).concat(textMediaPaths))]
  for (const path of referencedPaths) {
    const asset = media.find(item => item.path === path)
    if (!asset) throw new Error(`Missing media file: ${path}.`)
    if (!(asset.content instanceof Blob) || asset.content.size !== asset.size || !/^[a-f0-9]{64}$/i.test(asset.sha256)) throw new Error(`Media integrity check failed for ${asset.name}. Restore or replace the file before exporting.`)
    const bytes = await asset.content.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    if (checksum !== asset.sha256.toLowerCase()) throw new Error(`Media integrity check failed for ${asset.name}. Restore or replace the file before exporting.`)
    zip.file(path, bytes, { date: new Date('1980-01-01T00:00:00Z') })
  }
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]
    const outputPath = paths[index].toLowerCase()
    if (Object.values(zip.files).some(entry => {
      const existingPath = entry.name.replace(/\/$/, '').toLowerCase()
      return existingPath === outputPath || existingPath.startsWith(`${outputPath}/`) || (!entry.dir && outputPath.startsWith(`${existingPath}/`))
    })) throw new Error(`Page ${page.name} conflicts with an exported asset or folder: ${paths[index]}.`)
    const depth = paths[index].split('/').length - 1
    const prefix = '../'.repeat(depth)
    const nav = pages.map((target, targetIndex) => `<a href="${escapeHtml(prefix + encodeURI(paths[targetIndex]))}"${target.id === page.id ? ' aria-current="page"' : ''} class="min-w-0 [overflow-wrap:anywhere] hover:text-text-0">${escapeHtml(target.name)}</a>`).join(' ') + (articles.length ? ` <a href="${prefix}articles/index.html" class="min-w-0 [overflow-wrap:anywhere] hover:text-text-0">Articles</a>` : '') + (options?.settings?.siteSearch === 'on' ? ` <a href="${prefix}search.html" class="min-w-0 [overflow-wrap:anywhere] hover:text-text-0">Search</a>` : '')
    const article = page.webstudioArticle
    const articleHeader = article && (article.author || article.summary || article.tags?.length) ? `<header class="px-6 py-3 text-text-1">${article.author ? `<p class="text-sm">By ${escapeHtml(article.author)}</p>` : ''}${article.summary ? `<p class="text-sm">${escapeHtml(article.summary)}</p>` : ''}${article.tags?.length ? `<p class="text-sm">Tags: ${article.tags.map(escapeHtml).join(', ')}</p>` : ''}</header>` : ''
    const pageSettings = { ...options?.settings, ...(page.webstudioSeo?.title?.trim() ? { seoTitle: page.webstudioSeo.title } : {}), ...(page.webstudioSeo?.description?.trim() ? { seoDescription: page.webstudioSeo.description } : {}) }
    const html = exportSiteToHTML({ ...validated, name: page.name, blocks: page.blocks }, { settings: pageSettings })
      .replace('</head>', canonicalBase ? `  <link rel="canonical" href="${escapeHtml(new URL(encodeURI(paths[index]), canonicalBase).href)}" />\n  <meta property="og:url" content="${escapeHtml(new URL(encodeURI(paths[index]), canonicalBase).href)}" />\n</head>` : '</head>')
      .replace('<!-- WEBSTUDIO_PAGE_NAV -->', `<nav aria-label="Site pages" class="flex flex-wrap gap-x-4 gap-y-2 px-6 py-3 bg-bg-1 text-text-1">${nav}</nav>`)
      .replace('<main id="main-content" tabindex="-1" class="@container">', `<main id="main-content" tabindex="-1" class="@container">${articleHeader}`)
      .replace(/\b(src|href|data)="assets\//g, `$1="${prefix}assets/`)
      .replace(/(<a\s[^>]*?\bhref=")([^"]*)(")/gi, (match, start: string, href: string, end: string) => {
        const separator = href.search(/[?#]/)
        const path = separator < 0 ? href : href.slice(0, separator)
        const suffix = separator < 0 ? '' : href.slice(separator)
        const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
        const draft = allPages.find(target => target.webstudioArticle?.status === 'draft' && (normalized === escapeHtml(target.path) || normalized === escapeHtml(encodeURI(target.path))))
        if (draft) throw new Error(`Page ${page.name} links to the draft article ${draft.name}.`)
        const targetIndex = pages.findIndex(target => normalized === escapeHtml(target.path) || normalized === escapeHtml(encodeURI(target.path)))
        return targetIndex < 0 ? match : `${start}${escapeHtml(prefix + encodeURI(paths[targetIndex]))}${suffix}${end}`
      })
    zip.file(paths[index], html, { date: new Date('1980-01-01T00:00:00Z') })
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export function downloadHTML(html: string | Blob, filename: string): void {
  const blob = typeof html === 'string' ? new Blob([html], { type: 'text/html' }) : html
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function previewHTML(html: string): void {
  const previewWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!previewWindow) {
    throw new Error('Preview popup was blocked')
  }
  previewWindow.document.open()
  previewWindow.document.write(html)
  previewWindow.document.close()
}
