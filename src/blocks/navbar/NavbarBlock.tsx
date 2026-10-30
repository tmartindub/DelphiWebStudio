import type { BlockConfig } from '../types'
import { Menu } from 'lucide-react'

interface NavbarProps {
  logo: string
  logoImage?: string
  links: string[]
  navItems?: { label: string; url: string }[]
  ctaText: string
  ctaUrl?: string
}

function NavbarDefault({ props }: { props: NavbarProps }) {
  const { logo, logoImage, links = [], ctaText, ctaUrl } = props
  const navItems = Array.isArray(props.navItems) ? props.navItems.filter(item => item && typeof item.label === 'string' && typeof item.url === 'string') : []

  return (
    <nav className="px-6 @md:px-10 py-4 flex flex-wrap gap-3 items-center justify-between">
      {/* Logo */}
      <div className="flex min-w-0 items-center gap-2">
        {logoImage ? <img src={logoImage} alt={logo} className="h-8 w-auto max-w-[96px] shrink-0 object-contain" /> : <div className="w-8 h-8 shrink-0 rounded-lg bg-green/10 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-green" />
        </div>}
        <span className="min-w-0 font-semibold text-[15px] text-text-0 tracking-tight">{logo}</span>
      </div>

      {/* Desktop nav links */}
      <div className="hidden @2xl:flex flex-wrap items-center gap-6">
        {links.map((link, i) => (
          <span
            key={i}
            className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer"
          >
            {link}
          </span>
        ))}
        {navItems.map((item, i) => <a key={`nav-${i}`} href={item.url || undefined} className="text-[13px] text-text-2 hover:text-text-0">{item.label}</a>)}
      </div>

      {/* CTA + mobile menu */}
      <div className="flex items-center gap-3">
        {ctaText && <a href={ctaUrl || undefined} className="px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold hover:bg-green-dim transition-colors">
          {ctaText}
        </a>}
        {navItems.length > 0 && <details className="@2xl:hidden relative"><summary aria-label="Navigation menu" className="w-9 h-9 rounded-lg border border-border-default flex items-center justify-center text-text-2 cursor-pointer"><Menu size={16} /></summary><div className="absolute right-0 z-10 w-56 max-h-[60vh] overflow-y-auto [overflow-wrap:anywhere] p-3 bg-bg-1 border border-border-default rounded-lg flex flex-col gap-3">{navItems.map((item, i) => <a key={i} href={item.url || undefined} className="text-sm text-text-2">{item.label}</a>)}</div></details>}
      </div>
    </nav>
  )
}

function NavbarCentered({ props }: { props: NavbarProps }) {
  const { logo, logoImage, links = [], ctaText, ctaUrl } = props
  const navItems = Array.isArray(props.navItems) ? props.navItems.filter(item => item && typeof item.label === 'string' && typeof item.url === 'string') : []
  const mid = Math.ceil(links.length / 2)
  const leftLinks = links.slice(0, mid)
  const rightLinks = links.slice(mid)

  return (
    <nav className="px-6 @md:px-10 py-4 flex flex-wrap gap-3 items-center justify-between">
      {/* Left links */}
      <div className="hidden @2xl:flex flex-wrap items-center gap-6 flex-1">
        {leftLinks.map((link, i) => (
          <span key={i} className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer">
            {link}
          </span>
        ))}
      </div>

      {/* Center logo */}
      <div className="flex min-w-0 items-center gap-2">
        {logoImage ? <img src={logoImage} alt={logo} className="h-8 w-auto max-w-[96px] shrink-0 object-contain" /> : <div className="w-8 h-8 shrink-0 rounded-lg bg-green/10 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-green" />
        </div>}
        <span className="min-w-0 font-semibold text-[15px] text-text-0 tracking-tight">{logo}</span>
      </div>

      {/* Right links + CTA */}
      <div className="hidden @2xl:flex flex-wrap items-center gap-6 flex-1 justify-end">
        {rightLinks.map((link, i) => (
          <span key={i} className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer">
            {link}
          </span>
        ))}
        {navItems.map((item, i) => <a key={`nav-${i}`} href={item.url || undefined} className="text-[13px] text-text-2 hover:text-text-0">{item.label}</a>)}
        {ctaText && <a href={ctaUrl || undefined} className="px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold hover:bg-green-dim transition-colors ml-2">
          {ctaText}
        </a>}
      </div>

      {ctaText && <a href={ctaUrl || undefined} className="@2xl:hidden px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold">{ctaText}</a>}
      {/* Mobile menu */}
      {navItems.length > 0 && <details className="@2xl:hidden relative"><summary aria-label="Navigation menu" className="w-9 h-9 rounded-lg border border-border-default flex items-center justify-center text-text-2 cursor-pointer"><Menu size={16} /></summary><div className="absolute right-0 z-10 w-56 max-h-[60vh] overflow-y-auto [overflow-wrap:anywhere] p-3 bg-bg-1 border border-border-default rounded-lg flex flex-col gap-3">{navItems.map((item, i) => <a key={i} href={item.url || undefined} className="text-sm text-text-2">{item.label}</a>)}</div></details>}
    </nav>
  )
}

export function NavbarBlock({ block }: { block: BlockConfig }) {
  const props = block.props as unknown as NavbarProps

  switch (block.variant) {
    case 'centered':
      return <NavbarCentered props={props} />
    default:
      return <NavbarDefault props={props} />
  }
}
