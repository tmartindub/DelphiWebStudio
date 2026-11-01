import { useState } from 'react'
import { toast } from 'sonner'
import { Search, Layout, Type, Grid3X3, DollarSign, Megaphone, PanelBottom, MessageSquare, BarChart3, HelpCircle, Users, Mail, Newspaper, Image, Plus, Minus, Flag, FileText, ImageIcon, Play, GalleryHorizontalEnd } from 'lucide-react'
import { LayersPanel } from './LayersPanel'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { blockMetadata } from '@/lib/block-metadata'
import type { BlockType, BlockConfig } from '@/blocks/types'
import { MediaPanel } from '@/media/MediaPanel'
import { ArticlesPanel } from './ArticlesPanel'

const blockIcons: Record<BlockType, typeof Layout> = {
  navbar: Layout, hero: Type, features: Grid3X3, pricing: DollarSign,
  cta: Megaphone, footer: PanelBottom, testimonials: MessageSquare,
  stats: BarChart3, faq: HelpCircle, team: Users, contact: Mail,
  newsletter: Newspaper, logocloud: Image, divider: Minus, banner: Flag,
  content: FileText, image: ImageIcon, video: Play, gallery: GalleryHorizontalEnd, pdfViewer: FileText,
  document: FileText, documentLibrary: FileText, audio: Play, mediaVideo: Play,
}

const noReusableSections: NonNullable<import('@/blocks/types').SiteConfig['webstudioReusableSections']> = []

function ComponentsPanel() {
  const [search, setSearch] = useState('')
  const [sectionName, setSectionName] = useState('')
  const addBlock = useConfigStore((s) => s.addBlock)
  const sections = useConfigStore((s) => s.config.webstudioReusableSections ?? noReusableSections)
  const saveReusableSection = useConfigStore((s) => s.saveReusableSection)
  const insertReusableSection = useConfigStore((s) => s.insertReusableSection)
  const removeReusableSection = useConfigStore((s) => s.removeReusableSection)
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const filtered = blockMetadata.filter((b) =>
    b.type !== 'pricing' && (b.label.toLowerCase().includes(search.toLowerCase()) ||
    b.category.toLowerCase().includes(search.toLowerCase()))
  )

  const grouped = filtered.reduce<Record<string, typeof blockMetadata>>((acc, b) => {
    if (!acc[b.category]) acc[b.category] = []
    acc[b.category].push(b)
    return acc
  }, {})

  function handleAdd(type: BlockType) {
    const meta = blockMetadata.find((b) => b.type === type)
    if (!meta) return
    const block: BlockConfig = {
      id: `block-${crypto.randomUUID()}`,
      type,
      variant: meta.variants[0],
      props: { ...meta.defaultProps },
    }
    addBlock(block)
    selectBlock(block.id)
    toast(`${meta.label} added`)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-2 py-1.5 rounded-md border border-border-default bg-bg-2 text-text-0 text-[11px] outline-none focus:border-green placeholder:text-text-3"
            style={{ paddingLeft: '1.625rem' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="px-1.5 pt-2.5 pb-2 border-b border-border-default">
          <div className="text-[10px] font-semibold uppercase text-text-2">Reusable sections</div>
          <p className="text-[11px] text-text-3 mt-1">Select a section on the page to save a copy for this project.</p>
          <label className="sr-only" htmlFor="reusable-section-name">Section name</label>
          <input id="reusable-section-name" value={sectionName} onChange={event => setSectionName(event.target.value)} placeholder="Section name" className="mt-2 w-full rounded border border-border-default bg-bg-2 px-2 py-1.5 text-xs" />
          <button type="button" disabled={!selectedBlockId || !sectionName.trim()} onClick={() => {
            if (!selectedBlockId) return
            if (!useConfigStore.getState().getActivePageBlocks().some(block => block.id === selectedBlockId)) { toast.error('Select a section on the current page first'); return }
            saveReusableSection(selectedBlockId, sectionName)
            setSectionName('')
            toast('Section saved in this project')
          }} className="mt-1 w-full rounded border border-border-default px-2 py-1.5 text-xs disabled:opacity-40">Save selected section</button>
          {sections.map(section => <div key={section.id} className="mt-2 flex items-center gap-1">
            <button type="button" onClick={() => { insertReusableSection(section.id); toast('Section added to this page') }} className="flex-1 rounded bg-bg-3 px-2 py-1.5 text-left text-xs" title="Add a copy to the current page">{section.name}</button>
            <button type="button" onClick={() => { removeReusableSection(section.id); toast('Saved section removed; use Undo to restore it') }} aria-label={`Remove saved section ${section.name}`} className="rounded px-2 py-1.5 text-xs hover:bg-bg-3">Remove</button>
          </div>)}
        </div>
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-text-3 px-1.5 pt-2.5 pb-1">
              {category}
            </div>
            {items.map((meta) => {
              const Icon = blockIcons[meta.type] || Layout
              return (
                <button
                  key={meta.type}
                  draggable
                  onDragStart={(event) => { event.dataTransfer.setData('application/x-webstudio-component', meta.type); event.dataTransfer.effectAllowed = 'copy' }}
                  onClick={() => handleAdd(meta.type)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-text-1 hover:bg-bg-3 hover:text-text-0 transition-colors text-left group"
                >
                  <div className="w-[22px] h-[22px] rounded border border-border-default bg-bg-3 flex items-center justify-center text-[10px] shrink-0">
                    <Icon size={12} />
                  </div>
                  <span className="flex-1">{meta.label}</span>
                  <Plus size={11} className="text-text-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-6 text-center text-[11px] text-text-3">
            No components match "{search}"
          </div>
        )}
      </div>
    </div>
  )
}

type Tab = 'layers' | 'components' | 'media' | 'articles'

export function LeftSidebar() {
  const mode = useEditorStore((state) => state.mode)
  const [tab, setTab] = useState<Tab>(() => mode === 'beginner' ? 'components' : 'layers')

  return (
    <div className="hidden md:flex w-[280px] bg-bg-1 border-r border-border-default flex-col shrink-0">
      <div className="flex border-b border-border-default shrink-0">
        <button
          onClick={() => setTab('layers')}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            tab === 'layers'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Layers
        </button>
        <button
          onClick={() => setTab('components')}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            tab === 'components'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Components
        </button>
        <button onClick={() => setTab('media')} className={`flex-1 py-2 text-[11px] font-medium transition-all ${tab === 'media' ? 'text-text-0 border-b border-green' : 'text-text-3 hover:text-text-1'}`}>Media</button>
        <button onClick={() => setTab('articles')} className={`flex-1 py-2 text-[11px] font-medium transition-all ${tab === 'articles' ? 'text-text-0 border-b border-green' : 'text-text-3 hover:text-text-1'}`}>Articles</button>
      </div>
      {tab === 'layers' ? <LayersPanel /> : tab === 'components' ? <ComponentsPanel /> : tab === 'media' ? <MediaPanel /> : <ArticlesPanel />}
    </div>
  )
}
