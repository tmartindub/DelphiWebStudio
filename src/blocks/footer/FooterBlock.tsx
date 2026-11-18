import type { BlockConfig } from '../types'

interface FooterProps {
  logo: string
  logoImage?: string
  description?: string
  copyright: string
  links: string[]
  navItems?: { label: string; url: string }[]
  columns?: { title: string; links: string[] }[]
  resources?: { src?: string; alt?: string; title?: string; description?: string; url?: string }[]
  resourceButtons?: { label?: string; url?: string }[]
}

function FooterSimple({ props }: { props: FooterProps }) {
  const links = Array.isArray(props.links) ? props.links : []
  const navItems = Array.isArray(props.navItems) ? props.navItems.filter(item => item && typeof item.label === 'string' && typeof item.url === 'string') : []
  return (
    <footer className="px-6 @md:px-10 py-8 border-t border-border-subtle">
      <div className="flex flex-col @lg:flex-row items-center justify-between gap-4">
        {(props.logo || props.logoImage) && <div className="flex min-w-0 items-center gap-2">
          {props.logoImage && (
            <img src={props.logoImage} alt={props.logo} className="h-6 w-auto max-w-[96px] shrink-0 object-contain" />
          )}
          {props.logo && <span className="min-w-0 text-sm font-semibold text-text-1">{props.logo}</span>}
        </div>}

        <div className="flex flex-wrap items-center gap-4">
          {links.map((link, i) => (
            <span
              key={i}
              className="text-[12px] text-text-3 hover:text-text-1 transition-colors cursor-pointer"
            >
              {link}
            </span>
          ))}
          {navItems.map((item, i) => <a key={`nav-${i}`} href={item.url || undefined} className="text-[12px] text-text-3 hover:text-text-1">{item.label}</a>)}
        </div>

        <span className="text-[11px] text-text-3">{props.copyright}</span>
      </div>
    </footer>
  )
}

function FooterMultiColumn({ props }: { props: FooterProps }) {
  const columns = props.columns || []
  const links = Array.isArray(props.links) ? props.links : []
  const navItems = Array.isArray(props.navItems) ? props.navItems.filter(item => item && typeof item.label === 'string' && typeof item.url === 'string') : []

  return (
    <footer className="border-t border-border-subtle px-5 py-6 @md:px-8 @md:py-10 [overflow-wrap:anywhere]">
      <div className="mx-auto mb-5 grid max-w-6xl grid-cols-1 gap-x-6 gap-y-4 @md:mb-6 @md:gap-y-5 @min-[28rem]:grid-cols-2 @min-[45rem]:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
        {/* Brand column */}
        {(props.logo || props.logoImage || props.description) && <div className="min-w-0 @min-[28rem]:col-span-2 @min-[45rem]:col-span-1">
          {(props.logo || props.logoImage) && <div className="flex min-w-0 items-center gap-2 mb-3">
            {props.logoImage && (
              <img src={props.logoImage} alt={props.logo} className="h-7 w-auto max-w-[96px] shrink-0 object-contain" />
            )}
            {props.logo && <span className="min-w-0 text-sm font-semibold">{props.logo}</span>}
          </div>}
          {props.description && <p className="text-[12px] text-text-3 leading-relaxed max-w-[200px]">{props.description}</p>}
        </div>}

        {/* Link columns */}
        {columns.map((col, i) => (
          <div key={i} className="min-w-0">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-2 @md:mb-3">
              {col.title}
            </h2>
            <ul className="space-y-1.5 @md:space-y-2">
              {col.links.map((link, j) => (
                <li key={j}>
                  <span className="text-[12.5px] text-text-3 hover:text-text-1 transition-colors cursor-pointer">
                    {link}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-border-subtle pt-4 @min-[52rem]:flex-row @min-[52rem]:items-center @min-[52rem]:justify-between">
        <span className="text-[11px] text-text-3">{props.copyright}</span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          {links.map((link, i) => (
            <span
              key={i}
              className="text-[11px] text-text-3 hover:text-text-1 transition-colors cursor-pointer"
            >
              {link}
            </span>
          ))}
          {navItems.map((item, i) => <a key={`nav-${i}`} href={item.url || undefined} className="text-[11px] text-text-3 hover:text-text-1">{item.label}</a>)}
        </div>
      </div>
    </footer>
  )
}

function FooterMinimal({ props }: { props: FooterProps }) {
  const links = Array.isArray(props.links) ? props.links : []
  const navItems = Array.isArray(props.navItems) ? props.navItems.filter(item => item && typeof item.label === 'string' && typeof item.url === 'string') : []
  return (
    <footer className="px-6 @md:px-10 py-6">
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-text-3">
        <span>{props.copyright}</span>
        {links.length > 0 && <span className="mx-1">|</span>}
        {links.map((link, i) => (
          <span key={i}>
            <span className="hover:text-text-1 transition-colors cursor-pointer">{link}</span>
            {i < links.length - 1 && <span className="mx-1">|</span>}
          </span>
        ))}
        {navItems.map((item, i) => <span key={`nav-${i}`}>{(props.copyright || links.length > 0 || i > 0) && <span className="mx-1">|</span>}<a href={item.url || undefined} className="hover:text-text-1">{item.label}</a></span>)}
      </div>
    </footer>
  )
}

export function FooterBlock({ block }: { block: BlockConfig }) {
  const savedProps = block.props as unknown as FooterProps
  const props = { ...savedProps, logo: typeof savedProps.logo === 'string' && savedProps.logo.trim() !== 'Brand' ? savedProps.logo.trim() : '' }

  switch (block.variant) {
    case 'resources':
      return <footer className="px-6 @md:px-10 py-12">
        {props.logo && <h2 className="mb-8 text-center text-xl font-semibold">{props.logo}</h2>}
        <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-4 gap-8">
          {(Array.isArray(props.resources) ? props.resources : []).map((item, index) => {
            if (!item || typeof item !== 'object') return null
            const url = typeof item.url === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(item.url) ? item.url : undefined
            const image = item.src ? <img src={item.src} alt={item.alt || item.title || ''} className="mx-auto max-w-full h-auto" /> : null
            return <div key={index} className="text-center">
              {url && image ? <a href={url}>{image}</a> : image}
              {item.title && <p className="mt-2">{url ? <a href={url} className="underline">{item.title}</a> : item.title}</p>}
              {item.description && <p className="mt-2 whitespace-pre-wrap">{item.description}</p>}
            </div>
          })}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {(Array.isArray(props.resourceButtons) ? props.resourceButtons : []).map((item, index) => item && typeof item.url === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(item.url) && item.label ? <a data-ws-block-button key={index} href={item.url} className="rounded border border-current px-5 py-2 text-center">{item.label}</a> : null)}
        </div>
      </footer>
    case 'multi-column':
      return <FooterMultiColumn props={props} />
    case 'minimal':
      return <FooterMinimal props={props} />
    default:
      return <FooterSimple props={props} />
  }
}
