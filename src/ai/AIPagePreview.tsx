import type { CSSProperties } from 'react'
import type { SiteConfig } from '@/blocks/types'
import { BlockWrapper } from '@/blocks/BlockWrapper'
import { RenderBlock } from '@/blocks/registry'
import { resolveTheme, themeToCSS } from '@/lib/theme-presets'

export function AIPagePreview({ config, pageId, width, label, assetUrls = {} }: { config: SiteConfig; pageId: string; width: number; label: string; assetUrls?: Record<string, string> }) {
  const theme = resolveTheme(config.theme), page = config.pages?.find(item => item.id === pageId)
  const displayMedia = (value: unknown): unknown => typeof value === 'string' ? assetUrls[value] ?? value : Array.isArray(value) ? value.map(displayMedia) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, displayMedia(item)])) : value
  return <div aria-label={label} className="max-h-[50vh] overflow-auto rounded border border-slate-500 bg-slate-100 [&_[data-ws-object-type=image]:empty]:min-h-32 [&_[data-ws-object-type=image]:empty]:border [&_[data-ws-object-type=image]:empty]:border-dashed [&_[data-ws-object-type=image]:empty]:border-slate-400 [&_[data-ws-object-type=image]:empty]:after:content-['Photo_space']" onClickCapture={event => { if ((event.target as Element).closest('a')) event.preventDefault() }} onSubmitCapture={event => event.preventDefault()}>
    <div inert className="@container scroll-revealed" style={{ ...themeToCSS(theme), width, minWidth: width, backgroundColor: theme.bg0, color: theme.text0, containerType: 'inline-size' } as CSSProperties}>
      {page?.blocks.filter(block => !block.webstudioHiddenOn?.[width < 480 ? 'mobile' : width < 900 ? 'tablet' : 'desktop']).map(block => {
        const shown = { ...block, props: displayMedia(block.props) as Record<string, unknown> }
        return <BlockWrapper key={block.id} block={shown} isSelected={false} onSelect={() => undefined} readOnlyPreview={label.replace(/[^a-z]/gi, '')}><RenderBlock block={shown} /></BlockWrapper>
      })}
    </div>
  </div>
}
