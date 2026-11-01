import { useEffect, useMemo, useState } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { CanvasEmpty } from './CanvasEmpty'
import { BlockWrapper } from '@/blocks/BlockWrapper'
import { RenderBlock } from '@/blocks/registry'
import { resolveTheme, themeToCSS } from '@/lib/theme-presets'
import { useProjectsStore } from '@/store/projectsStore'
import { ProjectMediaLibrary } from '@/media/media-library'
import { toast } from 'sonner'
import { blockMetadata } from '@/lib/block-metadata'

export function Canvas() {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const theme = useConfigStore((s) => s.config.theme)
  const pages = useConfigStore((s) => s.config.pages)
  const activePageId = useConfigStore((s) => s.activePageId)
  const activeArticle = pages?.find(page => page.id === activePageId)?.webstudioArticle
  const setActivePage = useConfigStore((s) => s.setActivePage)
  const { selectedBlockId, selectBlock, viewport, customViewportWidth, activeProjectId, previewMode } = useEditorStore()
  const revision = useProjectsStore(state => state.projects.find(project => project.id === activeProjectId)?.mediaRevision ?? 0)
  const searchEnabled = useProjectsStore(state => state.projects.find(project => project.id === activeProjectId)?.settings?.siteSearch === 'on')
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const referencedAssets = JSON.stringify([...new Set([
    ...blocks.map(block => typeof block.props.assetId === 'string' ? block.props.assetId : '').filter(Boolean),
    ...(JSON.stringify(blocks).match(/assets\/[a-zA-Z0-9._-]+/g) ?? []),
  ])].sort())

  useEffect(() => {
    if (!activeProjectId) return
    let active = true
    const urls: string[] = []
    new ProjectMediaLibrary().list(activeProjectId).then(assets => {
      if (!active) return
      const mapped: Record<string, string> = {}
      const referenced = new Set<string>(JSON.parse(referencedAssets))
      for (const asset of assets) if (referenced.has(asset.id) || referenced.has(asset.path)) {
        const url = URL.createObjectURL(asset.content)
        mapped[asset.id] = url
        mapped[asset.path] = url
        urls.push(url)
      }
      setAssetUrls(mapped)
    }).catch(() => { if (active) setAssetUrls({}) })
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [activeProjectId, revision, referencedAssets])

  const resolved = useMemo(() => resolveTheme(theme), [theme])
  const cssVars = useMemo(() => themeToCSS(resolved), [resolved])

  const previewWidth = customViewportWidth ?? (viewport === 'desktop' ? 1200 : viewport === 'tablet' ? 768 : 375)

  const canvasContent = (
    <div
      className="@container outline outline-1 rounded-xl min-h-[400px] relative z-[1] overflow-hidden transition-all duration-300 mx-auto shrink-0"
      style={{ width: `${previewWidth}px`, ...cssVars, color: 'var(--color-text-0)', backgroundColor: 'var(--color-bg-1)', outlineColor: 'var(--color-border-default)', overflowWrap: 'anywhere' } as React.CSSProperties}
      onClick={(e) => {
        if (previewMode && !e.defaultPrevented && e.target instanceof Element) {
          const link = e.target.closest('a[href]')
          if (link) {
            const href = link.getAttribute('href') ?? ''
            if (link.hasAttribute('download') && href.startsWith('blob:')) return
            e.preventDefault()
            const path = href.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
            const target = pages?.find(page => page.path === path && page.webstudioArticle?.status !== 'draft')
            if (target && href.startsWith('/')) { setActivePage(target.id); selectBlock(null) }
            else toast('Open the exported website to follow this link.')
            return
          }
        }
        if (e.target === e.currentTarget) selectBlock(null)
      }}
      role="region"
      aria-label={`Site preview, ${blocks.length} blocks, ${viewport} viewport`}
    >
      {pages && <nav aria-label="Site pages" className="flex flex-wrap gap-x-4 gap-y-2 px-6 py-3 bg-bg-1 text-text-1">
        {pages.filter(page => page.webstudioArticle?.status !== 'draft').map(page => <a key={page.id} href={page.path} aria-current={page.id === activePageId ? 'page' : undefined} className="min-w-0 [overflow-wrap:anywhere] hover:text-text-0" onClick={event => { event.preventDefault(); setActivePage(page.id); selectBlock(null) }}>{page.name}</a>)}
        {pages.some(page => page.webstudioArticle?.status === 'ready') && <a href="#article-index" className="min-w-0 [overflow-wrap:anywhere] hover:text-text-0" onClick={event => { event.preventDefault(); toast('The article list is available in the exported website ZIP.') }}>Articles</a>}
        {searchEnabled && <a href="#site-search" className="min-w-0 [overflow-wrap:anywhere] hover:text-text-0" onClick={event => { event.preventDefault(); toast('Site search is available in the exported website ZIP.') }}>Search</a>}
      </nav>}
      {activeArticle && (activeArticle.author || activeArticle.summary || activeArticle.tags?.length) && <header className="px-6 py-3 text-text-1">
        {activeArticle.author && <p className="text-sm">By {activeArticle.author}</p>}
        {activeArticle.summary && <p className="text-sm">{activeArticle.summary}</p>}
        {!!activeArticle.tags?.length && <p className="text-sm">Tags: {activeArticle.tags.join(', ')}</p>}
      </header>}
      {blocks.length === 0 ? <div className="bg-[#dce8f3] min-h-[400px] flex"><CanvasEmpty /></div> : blocks.map((block) => {
        const device = previewWidth < 480 ? 'mobile' : previewWidth < 900 ? 'tablet' : 'desktop'
        const hiddenOnCurrentWidth = block.webstudioHiddenOn?.[device] === true
        if (previewMode && hiddenOnCurrentWidth) return null
        const props = Object.fromEntries(Object.entries(block.props).map(([key, value]) => {
          if (typeof value === 'string' && /^(src|image|logoImage|heroImage|avatar|url)$/i.test(key)) return [key, assetUrls[value] ?? value]
          if (Array.isArray(value)) return [key, value.map(item => item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(Object.entries(item).map(([itemKey, itemValue]) => [itemKey, typeof itemValue === 'string' && /^(src|image|logoImage|heroImage|avatar|url)$/i.test(itemKey) ? assetUrls[itemValue] ?? itemValue : itemValue]))
            : item)]
          return [key, value]
        }))
        if (typeof block.props.assetId === 'string' && assetUrls[block.props.assetId]) props.src = assetUrls[block.props.assetId]
        return (
        <BlockWrapper
          key={block.id}
          block={block}
          isSelected={selectedBlockId === block.id}
          hiddenOnCurrentWidth={hiddenOnCurrentWidth}
          onSelect={() => selectBlock(block.id)}
        >
          <RenderBlock block={{ ...block, props }} />
        </BlockWrapper>
        )
      })}
    </div>
  )

  return (
    <div className="flex-1 flex items-start justify-start p-6 overflow-auto relative bg-[#dce8f3]" onDragOver={event => {
      if (!previewMode && (event.dataTransfer.types.includes('application/x-webstudio-asset') || event.dataTransfer.types.includes('application/x-webstudio-component'))) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }
    }} onDrop={event => {
      if (previewMode) return
      const componentType = event.dataTransfer.getData('application/x-webstudio-component')
      if (componentType) {
        const meta = blockMetadata.find(item => item.type === componentType && item.type !== 'pricing')
        if (!meta) return
        event.preventDefault()
        const target = event.target instanceof Element ? event.target.closest('[data-webstudio-block-id]') : null
        const targetId = target?.getAttribute('data-webstudio-block-id')
        const targetIndex = blocks.findIndex(block => block.id === targetId)
        const index = targetIndex < 0 || !target ? undefined : targetIndex + (event.clientY >= target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2 ? 1 : 0)
        const id = `block-${crypto.randomUUID()}`
        useConfigStore.getState().addBlock({ id, type: meta.type, variant: meta.variants[0], props: structuredClone(meta.defaultProps) }, index)
        selectBlock(id)
        toast(`${meta.label} added`)
        return
      }
      const assetId = event.dataTransfer.getData('application/x-webstudio-asset')
      if (!assetId || !activeProjectId) return
      event.preventDefault()
      void new ProjectMediaLibrary().list(activeProjectId).then(assets => {
        const asset = assets.find(item => item.id === assetId)
        if (!asset || useEditorStore.getState().activeProjectId !== activeProjectId) throw new Error('The media file is no longer available.')
        const id = `block-${crypto.randomUUID()}`
        const type = asset.mime === 'application/pdf' ? 'pdfViewer' : asset.mime.startsWith('image/') ? 'image' : asset.mime.startsWith('audio/') ? 'audio' : asset.mime.startsWith('video/') ? 'mediaVideo' : 'document'
        useConfigStore.getState().addBlock({ id, type, variant: type === 'image' ? 'hero-image' : 'default', props: { assetId: asset.id, src: asset.path, title: asset.name, alt: asset.name } })
        useEditorStore.getState().selectBlock(id)
        toast('Added to page')
      }).catch(error => toast.error(error instanceof Error ? error.message : 'Media could not be added.'))
    }}>
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #9bb4ca 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {viewport === 'tablet' ? (
        <div className="relative z-[1] shrink-0 mx-auto" style={{ width: previewWidth + 24 }}>
          {/* Tablet frame */}
          <div className="border-[12px] border-bg-4 rounded-2xl bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="rounded-lg overflow-hidden">
              {canvasContent}
            </div>
          </div>
        </div>
      ) : viewport === 'mobile' ? (
        <div className="relative z-[1] shrink-0 mx-auto" style={{ width: previewWidth + 20 }}>
          {/* Phone frame */}
          <div className="border-[10px] border-bg-4 rounded-[2rem] bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            {/* Notch */}
            <div className="flex justify-center -mt-[4px] mb-1">
              <div className="w-24 h-5 bg-bg-4 rounded-b-xl" />
            </div>
            <div className="rounded-xl overflow-hidden">
              {canvasContent}
            </div>
            {/* Home indicator */}
            <div className="flex justify-center mt-2 pb-1">
              <div className="w-28 h-1 bg-bg-5 rounded-full" />
            </div>
          </div>
        </div>
      ) : (
        canvasContent
      )}
    </div>
  )
}
