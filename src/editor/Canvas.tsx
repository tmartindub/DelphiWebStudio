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
  const setActivePage = useConfigStore((s) => s.setActivePage)
  const { selectedBlockId, selectBlock, viewport, activeProjectId } = useEditorStore()
  const revision = useProjectsStore(state => state.projects.find(project => project.id === activeProjectId)?.mediaRevision ?? 0)
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

  const maxWidth = viewport === 'desktop' ? '1200px' : viewport === 'tablet' ? '768px' : '375px'

  const canvasContent = (
    <div
      className="@container outline outline-1 rounded-xl min-h-[400px] relative z-[1] overflow-hidden transition-all duration-300 mx-auto"
      style={{ width: '100%', maxWidth, ...cssVars, color: 'var(--color-text-0)', backgroundColor: 'var(--color-bg-1)', outlineColor: 'var(--color-border-default)', overflowWrap: 'anywhere' } as React.CSSProperties}
      onClick={(e) => {
        if (e.target === e.currentTarget) selectBlock(null)
      }}
      role="region"
      aria-label={`Site preview, ${blocks.length} blocks, ${viewport} viewport`}
    >
      {pages && <nav aria-label="Site pages" className="flex flex-wrap gap-x-4 gap-y-2 px-6 py-3 bg-bg-1 text-text-1">
        {pages.map(page => <a key={page.id} href={page.path} aria-current={page.id === activePageId ? 'page' : undefined} className="min-w-0 [overflow-wrap:anywhere] hover:text-text-0" onClick={event => { event.preventDefault(); setActivePage(page.id); selectBlock(null) }}>{page.name}</a>)}
      </nav>}
      {blocks.length === 0 ? <div className="bg-[#dce8f3] min-h-[400px] flex"><CanvasEmpty /></div> : blocks.map((block) => {
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
      if (event.dataTransfer.types.includes('application/x-webstudio-asset')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }
    }} onDrop={event => {
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
        <div className="relative z-[1] shrink-0 mx-auto w-[792px]">
          {/* Tablet frame */}
          <div className="border-[12px] border-bg-4 rounded-2xl bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="rounded-lg overflow-hidden">
              {canvasContent}
            </div>
          </div>
        </div>
      ) : viewport === 'mobile' ? (
        <div className="relative z-[1] shrink-0 mx-auto w-[395px]">
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
