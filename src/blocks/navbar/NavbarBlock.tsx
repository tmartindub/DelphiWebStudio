import { Fragment, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import type { BlockConfig, NavbarDestination, NavigationDestination } from '../types'
import { useEditorStore } from '@/store/editorStore'

interface NavbarProps {
  logo: string
  logoImage?: string
  links: string[]
  navItems?: NavbarDestination[]
  ctaText: string
  ctaUrl?: string
}

export function NavbarLinks({ items, editable = false }: { items: NavbarDestination[]; editable?: boolean }) {
  const id = useId()
  const linkClass = 'text-[13px] text-text-2 underline-offset-4 hover:underline focus-visible:underline'

  const renderDestination = ({ label, url }: NavigationDestination, parentIndex?: number) => {
    const destination = url.trim()
    const safe = destination && !/[\\\p{Cc}]/u.test(destination) && !destination.startsWith('//') &&
      (!/^[a-z][a-z\d+.-]*:/i.test(destination) || /^(https?:|mailto:|tel:)/i.test(destination))
    const draggable = editable && parentIndex !== undefined
    const className = parentIndex !== undefined ? linkClass : undefined
    return safe || draggable
      ? <a href={safe ? destination : undefined} draggable={draggable} title={draggable ? 'Drag to reorder' : undefined} data-ws-nav-index={parentIndex} className={className}>{label}</a>
      : <span className={className}>{label}</span>
  }

  return items.map((item, index) => {
    const parent = renderDestination(item, index)
    const children = Array.isArray(item.children) ? item.children.filter(child => typeof child?.label === 'string' && child.label.trim() && typeof child.url === 'string' && child.url.trim()) : []
    if (!children.length) return <Fragment key={index}>{parent}</Fragment>

    const submenuId = `${id}-submenu-${index}`
    return <div key={index} className="inline-flex min-w-0 items-center gap-1">
      {parent}
      <button type="button" data-ws-navbar-toggle popoverTarget={submenuId} aria-label={`Submenu for ${item.label || 'navigation link'}`}>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <ul id={submenuId} popover="auto" data-ws-navbar-submenu>
        {children.map((child, childIndex) => <li key={childIndex}>{renderDestination(child)}</li>)}
      </ul>
    </div>
  })
}

function NavbarDefault({ props, editable }: { props: NavbarProps; editable: boolean }) {
  const { logo, logoImage, links = [], ctaText, ctaUrl } = props
  const navItems = Array.isArray(props.navItems) ? props.navItems.filter(item => item && typeof item.label === 'string' && typeof item.url === 'string') : []

  return (
    <nav data-ws-navbar className="px-6 @md:px-10 py-4 flex flex-wrap gap-3 items-center justify-between">
      {/* Logo */}
      {(logoImage || logo) && <div className="flex min-w-0 items-center gap-2">
        {logoImage && <img src={logoImage} alt={logo} className="h-8 w-auto max-w-[96px] shrink-0 object-contain" />}
        <span className="min-w-0 font-semibold text-[15px] text-text-0 tracking-tight">{logo}</span>
      </div>}

      {/* Desktop nav links */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 [overflow-wrap:anywhere]">
        <NavbarLinks items={navItems} editable={editable} />
        {links.map((link, i) => (
          <span
            key={i}
            draggable={editable} title={editable ? 'Drag to reorder' : undefined} data-ws-nav-index={navItems.length + i}
            className="text-[13px] text-text-2 underline-offset-4 hover:underline cursor-pointer"
          >
            {link}
          </span>
        ))}
      </div>

      {/* CTA + mobile menu */}
      <div className="flex items-center gap-3">
        {ctaText && <a data-ws-block-button href={ctaUrl || undefined} className="px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold hover:bg-green-dim transition-colors">
          {ctaText}
        </a>}
      </div>
    </nav>
  )
}

function NavbarCentered({ props, editable }: { props: NavbarProps; editable: boolean }) {
  const { logo, logoImage, links = [], ctaText, ctaUrl } = props
  const navItems = Array.isArray(props.navItems) ? props.navItems.filter(item => item && typeof item.label === 'string' && typeof item.url === 'string') : []
  const mid = Math.ceil(links.length / 2)
  const leftLinks = links.slice(0, mid)
  const rightLinks = links.slice(mid)

  return (
    <nav data-ws-navbar className="px-6 @md:px-10 py-4 flex flex-wrap gap-3 items-center justify-between">
      {/* Left links */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 flex-1 [overflow-wrap:anywhere]">
        <NavbarLinks items={navItems} editable={editable} />
        {leftLinks.map((link, i) => (
          <span key={i} draggable={editable} title={editable ? 'Drag to reorder' : undefined} data-ws-nav-index={navItems.length + i} className="text-[13px] text-text-2 underline-offset-4 hover:underline cursor-pointer">
            {link}
          </span>
        ))}
      </div>

      {/* Center logo */}
      {(logoImage || logo) && <div className="flex min-w-0 items-center gap-2">
        {logoImage && <img src={logoImage} alt={logo} className="h-8 w-auto max-w-[96px] shrink-0 object-contain" />}
        <span className="min-w-0 font-semibold text-[15px] text-text-0 tracking-tight">{logo}</span>
      </div>}

      {/* Right links + CTA */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 flex-1 justify-end [overflow-wrap:anywhere]">
        {rightLinks.map((link, i) => (
          <span key={i} draggable={editable} title={editable ? 'Drag to reorder' : undefined} data-ws-nav-index={navItems.length + mid + i} className="text-[13px] text-text-2 underline-offset-4 hover:underline cursor-pointer">
            {link}
          </span>
        ))}
        {ctaText && <a data-ws-block-button href={ctaUrl || undefined} className="px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold hover:bg-green-dim transition-colors ml-2">
          {ctaText}
        </a>}
      </div>

    </nav>
  )
}

export function NavbarBlock({ block }: { block: BlockConfig }) {
  const props = block.props as unknown as NavbarProps
  const previewMode = useEditorStore(state => state.previewMode)

  switch (block.variant) {
    case 'centered':
      return <NavbarCentered props={props} editable={!previewMode} />
    default:
      return <NavbarDefault props={props} editable={!previewMode} />
  }
}
