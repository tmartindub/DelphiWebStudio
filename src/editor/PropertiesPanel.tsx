import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Code } from 'lucide-react'
import type { BlockConfig, BlockType } from '@/blocks/types'
import { useConfigStore } from '@/store/configStore'
import { portableProjectsEnabled } from '@/project/project-file'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { ProjectMediaLibrary, type MediaAsset } from '@/media/media-library'

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'image' | 'link' | 'textarea' | 'select' | 'checkbox' | 'array-strings' | 'array-items'
  options?: string[]
}

const blockFields: Partial<Record<BlockType, { sections: { title: string; fields: FieldDef[] }[] }>> = {
  document: { sections: [{ title: 'Document', fields: [{ key: 'title', label: 'Title', type: 'text' }] }] },
  audio: { sections: [{ title: 'Audio', fields: [{ key: 'title', label: 'Title', type: 'text' }] }] },
  mediaVideo: { sections: [{ title: 'Video', fields: [{ key: 'title', label: 'Title', type: 'text' }] }] },
  pdfViewer: { sections: [{ title: 'PDF', fields: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
    { key: 'height', label: 'Height (px)', type: 'text' },
    { key: 'initialPage', label: 'Starting page', type: 'text' },
    { key: 'fitMode', label: 'Fit mode', type: 'select', options: ['auto', 'width', 'page'] },
    { key: 'showThumbnails', label: 'Show page thumbnails', type: 'checkbox' },
    { key: 'showSearch', label: 'Show search', type: 'checkbox' },
    { key: 'showPrint', label: 'Show print link', type: 'checkbox' },
    { key: 'showDownload', label: 'Show download link', type: 'checkbox' },
    { key: 'showFullscreen', label: 'Show fullscreen', type: 'checkbox' },
  ] }] },
  navbar: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'logo', label: 'Logo Text', type: 'text' },
          { key: 'logoImage', label: 'Logo Image URL', type: 'image' },
          { key: 'ctaText', label: 'CTA Button', type: 'text' },
          { key: 'ctaUrl', label: 'CTA Destination', type: 'link' },
          { key: 'links', label: 'Legacy text-only labels', type: 'array-strings' },
          { key: 'navItems', label: 'Navigation destinations', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['default', 'centered'] },
        ],
      },
    ],
  },
  hero: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'badge', label: 'Badge', type: 'text' },
          { key: 'headline', label: 'Headline', type: 'text' },
          { key: 'subheadline', label: 'Subheadline', type: 'textarea' },
          { key: 'primaryCta', label: 'Primary CTA', type: 'text' },
          { key: 'primaryCtaUrl', label: 'Primary CTA URL', type: 'link' },
          { key: 'secondaryCta', label: 'Secondary CTA', type: 'text' },
          { key: 'secondaryCtaUrl', label: 'Secondary CTA URL', type: 'link' },
          { key: 'heroImage', label: 'Hero Image URL', type: 'image' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['centered', 'split', 'gradient', 'minimal'] },
        ],
      },
    ],
  },
  features: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'label', label: 'Section Label', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
        ],
      },
      {
        title: 'Items',
        fields: [
          { key: 'items', label: 'Feature Cards', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['grid', 'list', 'alternating'] },
        ],
      },
    ],
  },
  pricing: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'comparison'] },
        ],
      },
    ],
  },
  cta: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'headline', label: 'Headline', type: 'text' },
          { key: 'subheadline', label: 'Subheadline', type: 'text' },
          { key: 'buttonText', label: 'Button Text', type: 'text' },
          { key: 'buttonUrl', label: 'Button URL', type: 'link' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'split'] },
        ],
      },
    ],
  },
  footer: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'logo', label: 'Logo Text', type: 'text' },
          { key: 'logoImage', label: 'Logo Image URL', type: 'image' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'copyright', label: 'Copyright', type: 'text' },
          { key: 'links', label: 'Legacy text-only labels', type: 'array-strings' },
          { key: 'navItems', label: 'Navigation destinations', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'multi-column', 'minimal'] },
        ],
      },
    ],
  },
  testimonials: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'items', label: 'Testimonials', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['cards', 'carousel', 'spotlight'] },
        ],
      },
    ],
  },
  stats: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'items', label: 'Stats', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['grid', 'bar', 'counter'] },
        ],
      },
    ],
  },
  faq: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'items', label: 'Questions', type: 'array-items' },
        ],
      },
    ],
  },
  team: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'members', label: 'Members', type: 'array-items' },
        ],
      },
    ],
  },
  contact: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'recipientEmail', label: 'Contact Email', type: 'text' },
        ],
      },
    ],
  },
  newsletter: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'buttonText', label: 'Button Text', type: 'text' },
          { key: 'socialProof', label: 'Social Proof', type: 'text' },
        ],
      },
    ],
  },
  logocloud: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'logos', label: 'Logos', type: 'array-strings' },
        ],
      },
    ],
  },
  content: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'body', label: 'Body', type: 'textarea' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['prose', 'columns', 'highlight'] },
        ],
      },
    ],
  },
  image: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'src', label: 'Image URL', type: 'image' },
          { key: 'alt', label: 'Alt Text', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'imageSide', label: 'Image Side', type: 'select', options: ['left', 'right'] },
        ],
      },
      {
        title: 'Grid Images',
        fields: [
          { key: 'images', label: 'Images', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['hero-image', 'side-by-side', 'grid'] },
        ],
      },
    ],
  },
  video: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'url', label: 'Video URL', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Platform', type: 'select', options: ['youtube', 'vimeo'] },
        ],
      },
    ],
  },
  gallery: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'images', label: 'Images', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['grid', 'masonry'] },
        ],
      },
    ],
  },
  divider: {
    sections: [
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['line', 'space', 'dots'] },
          { key: 'width', label: 'Width', type: 'select', options: ['full', 'centered', 'narrow'] },
          { key: 'height', label: 'Height (px)', type: 'text' },
        ],
      },
    ],
  },
  banner: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'text', label: 'Text', type: 'text' },
          { key: 'linkText', label: 'Link Text', type: 'text' },
          { key: 'linkUrl', label: 'Link URL', type: 'link' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['ribbon', 'bar'] },
        ],
      },
    ],
  },
}

function PropertyField({ field, block }: { field: FieldDef; block: BlockConfig }) {
  const textArea = useRef<HTMLTextAreaElement>(null)
  const updateBlockProps = useConfigStore((s) => s.updateBlockProps)
  const updateBlock = useConfigStore((s) => s.updateBlock)
  const pages = useConfigStore((s) => s.config.pages)
  const projectId = useEditorStore((s) => s.activeProjectId)
  const mediaRevision = useProjectsStore((s) => s.projects.find(project => project.id === projectId)?.mediaRevision ?? 0)
  const [media, setMedia] = useState<{ projectId: string; revision: number; images: MediaAsset[] } | null>(null)
  const imageItems = field.type === 'array-items' && ((field.key === 'images' && (block.type === 'gallery' || block.type === 'image')) || (field.key === 'items' && block.type === 'features') || (field.key === 'members' && block.type === 'team'))
  const imageKey = block.type === 'features' ? 'image' : block.type === 'team' ? 'avatar' : 'src'
  const contentMedia = block.type === 'content' && field.key === 'body' && field.type === 'textarea'

  useEffect(() => {
    if (!portableProjectsEnabled || (field.type !== 'image' && !imageItems && !contentMedia) || !projectId) return
    let active = true
    new ProjectMediaLibrary().list(projectId).then(assets => {
      if (active) setMedia({ projectId, revision: mediaRevision, images: contentMedia ? assets : assets.filter(asset => asset.mime.startsWith('image/')) })
    }).catch(() => { if (active) setMedia({ projectId, revision: mediaRevision, images: [] }) })
    return () => { active = false }
  }, [field.type, imageItems, contentMedia, projectId, mediaRevision])

  // For variant field, it's on the block itself
  const value = field.key === 'variant'
    ? block.variant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (block.props as any)[field.key]

  const onChange = (newValue: unknown) => {
    if (field.key === 'variant') {
      updateBlock(block.id, { variant: newValue as string })
    } else {
      updateBlockProps(block.id, field.key === 'src' ? { [field.key]: newValue, assetId: undefined } : { [field.key]: newValue })
    }
  }

  switch (field.type) {
    case 'checkbox':
      return <label className="mb-2 flex items-center gap-2 text-xs text-text-1"><input type="checkbox" checked={field.key === 'showThumbnails' ? value === true : value !== false} onChange={event => onChange(event.target.checked)} /> {field.label}</label>
    case 'image': {
      const images = media?.projectId === projectId && media.revision === mediaRevision ? media.images : []
      const current = String(value || '')
      const selected = images.some(image => image.path === current) ? current : ''
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          <input type="text" aria-label={field.label} value={current} onChange={event => onChange(event.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green" />
          {portableProjectsEnabled && images.length > 0 && <select aria-label={`Choose image for ${field.label}`} value={selected}
            onChange={event => {
              const image = images.find(item => item.path === event.target.value)
              if (!image) return
              if (field.key === 'src') updateBlockProps(block.id, { src: image.path, assetId: image.id })
              else onChange(image.path)
            }} className="mt-1 w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green">
            <option value="">Choose an image from Media...</option>
            {images.map(image => <option key={image.id} value={image.path}>{image.name}</option>)}
          </select>}
        </div>
      )
    }

    case 'link': {
      const availablePages = (pages ?? []).filter(page => page.webstudioArticle?.status !== 'draft')
      const current = String(value || '')
      const selected = availablePages.some(page => page.path === current) ? current : ''
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          <input type="text" aria-label={field.label} value={current} onChange={event => onChange(event.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green" />
          {portableProjectsEnabled && availablePages.length > 0 && <select aria-label={`Choose a page for ${field.label}`} value={selected}
            onChange={event => { if (event.target.value) onChange(event.target.value) }}
            className="mt-1 w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green">
            <option value="">Choose a site page...</option>
            {availablePages.map(page => <option key={page.id} value={page.path}>{page.name} ({page.path})</option>)}
          </select>}
        </div>
      )
    }

    case 'text':
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green"
          />
        </div>
      )

    case 'textarea':
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          {contentMedia && <div role="toolbar" aria-label="Text formatting" className="mb-1 flex flex-wrap gap-1">
            {(['Bold', 'Italic', 'Heading', 'List'] as const).map(format => <button key={format} type="button" onMouseDown={event => event.preventDefault()} onClick={() => {
              const input = textArea.current
              if (!input) return
              const text = String(value || '')
              let start = input.selectionStart
              let end = input.selectionEnd
              let replacement: string
              let selectStart: number
              let selectEnd: number
              if (format === 'Bold' || format === 'Italic') {
                const marker = format === 'Bold' ? '**' : '*'
                replacement = marker + text.slice(start, end) + marker
                selectStart = start + marker.length
                selectEnd = selectStart + end - start
              } else {
                start = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1
                const lineEnd = text.indexOf('\n', end)
                end = lineEnd < 0 ? text.length : lineEnd
                const prefix = format === 'Heading' ? '## ' : '- '
                replacement = text.slice(start, end).split('\n').map(line => prefix + line).join('\n')
                selectStart = start + prefix.length
                selectEnd = start + replacement.length
              }
              onChange(text.slice(0, start) + replacement + text.slice(end))
              requestAnimationFrame(() => { input.focus(); input.setSelectionRange(selectStart, selectEnd) })
            }} className="rounded border border-border-default bg-bg-3 px-2 py-1 text-[11px] hover:bg-bg-4">{format}</button>)}
          </div>}
          <textarea
            ref={textArea}
            aria-label={field.label}
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green resize-y"
          />
          {contentMedia && <p className="mt-1 text-[10px] text-text-3">For a link, write [label](/page) or [label](https://example.com).</p>}
          {contentMedia && portableProjectsEnabled && media?.projectId === projectId && media.revision === mediaRevision && media.images.length > 0 && <select aria-label="Insert media link in Body" value="" onChange={event => {
            const asset = media.images.find(item => item.path === event.target.value)
            if (!asset) return
            const label = asset.name.replace(/[\x5b\x5d\r\n]/g, ' ').trim() || 'Open file'
            const current = String(value || '')
            onChange(`${current}${current ? '\n\n' : ''}[${label}](${asset.path})`)
          }} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-2 py-1.5 text-xs text-text-0">
            <option value="">Insert a link to Media...</option>
            {media.images.map(asset => <option key={asset.id} value={asset.path}>{asset.name}</option>)}
          </select>}
        </div>
      )

    case 'select':
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          <select
            aria-label={field.label}
            value={String(value || (field.key === 'fitMode' ? 'auto' : ''))}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green cursor-pointer"
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )

    case 'array-strings': {
      const items = (Array.isArray(value) ? value : []) as string[]
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          {items.map((item, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const updated = [...items]
                  updated[i] = e.target.value
                  onChange(updated)
                }}
                className="flex-1 px-2 py-1 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green"
              />
              <button
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="px-1.5 text-text-3 hover:text-status-red text-xs transition-colors"
              >
                x
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange([...items, ''])}
            className="text-[10px] text-green hover:text-green-dim transition-colors mt-0.5"
          >
            + Add item
          </button>
        </div>
      )
    }

    case 'array-items': {
      const items = (Array.isArray(value) ? value : []) as Array<Record<string, string>>
      const images = media?.projectId === projectId && media.revision === mediaRevision ? media.images : []

      // Infer new item shape from existing items, or use sensible defaults per field key
      function createEmptyItem(): Record<string, string> {
        if (items.length > 0) {
          const template: Record<string, string> = {}
          for (const key of Object.keys(items[0])) if (key !== 'assetId') template[key] = ''
          return template
        }
        // Fallback templates by block type + field key
        const blockTemplates: Partial<Record<string, Record<string, Record<string, string>>>> = {
          navbar: { navItems: { label: '', url: '' } },
          footer: { navItems: { label: '', url: '' } },
          testimonials: { items: { name: '', role: '', quote: '' } },
          stats: { items: { value: '', label: '' } },
          faq: { items: { question: '', answer: '' } },
          team: { members: { name: '', role: '' } },
          features: { items: { title: '', description: '' } },
          image: { images: { src: '', alt: '' } },
          gallery: { images: { src: '', alt: '', caption: '' } },
        }
        return blockTemplates[block.type]?.[field.key] || { title: '', description: '' }
      }

      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          {imageItems && block.type === 'features' && <p className="mb-1 text-[10px] text-text-3">Feature images appear in the alternating layout.</p>}
          {items.map((item, i) => (
            <div key={i} className="bg-bg-2 border border-border-default rounded p-2 mb-1.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-text-3 font-medium">Item {i + 1}</span>
                <button
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                  className="text-[10px] text-text-3 hover:text-status-red transition-colors"
                >
                  Remove
                </button>
              </div>
              {Object.entries(imageItems && !(imageKey in item) ? { ...item, [imageKey]: '' } : item).filter(([key]) => !(imageItems && key === 'assetId')).map(([key, val]) => (
                <div key={key} className="mb-1">
                  <label className="block text-[10px] text-text-3 mb-0.5">{key}</label>
                  <input
                    type="text"
                    aria-label={`${field.label} item ${i + 1} ${key}`}
                    value={String(val)}
                    onChange={(e) => {
                      const updated = [...items]
                      updated[i] = { ...updated[i], [key]: e.target.value }
                      if (imageItems && key === imageKey) delete updated[i].assetId
                      onChange(updated)
                    }}
                    className="w-full px-1.5 py-1 rounded border border-border-subtle bg-bg-3 text-text-0 text-[11px] outline-none focus:border-green"
                  />
                  {(block.type === 'navbar' || block.type === 'footer') && field.key === 'navItems' && key === 'url' && portableProjectsEnabled && (pages ?? []).some(page => page.webstudioArticle?.status !== 'draft') && <select
                    aria-label={`Choose a page for ${field.label} item ${i + 1}`}
                    value={(pages ?? []).some(page => page.path === val && page.webstudioArticle?.status !== 'draft') ? val : ''}
                    onChange={event => {
                      if (!event.target.value) return
                      const updated = [...items]
                      updated[i] = { ...updated[i], url: event.target.value }
                      onChange(updated)
                    }}
                    className="mt-1 w-full px-1.5 py-1 rounded border border-border-subtle bg-bg-3 text-text-0 text-[11px] outline-none focus:border-green">
                    <option value="">Choose a site page...</option>
                    {(pages ?? []).filter(page => page.webstudioArticle?.status !== 'draft').map(page => <option key={page.id} value={page.path}>{page.name} ({page.path})</option>)}
                  </select>}
                  {imageItems && key === imageKey && portableProjectsEnabled && images.length > 0 && <select
                    aria-label={`Choose image for ${field.label} item ${i + 1}`}
                    value={images.some(image => image.path === val) ? val : ''}
                    onChange={event => {
                      const image = images.find(candidate => candidate.path === event.target.value)
                      if (!image) return
                      const updated = [...items]
                      updated[i] = { ...updated[i], [imageKey]: image.path, assetId: image.id }
                      onChange(updated)
                    }}
                    className="mt-1 w-full px-1.5 py-1 rounded border border-border-subtle bg-bg-3 text-text-0 text-[11px] outline-none focus:border-green">
                    <option value="">Choose an image from Media...</option>
                    {images.map(image => <option key={image.id} value={image.path}>{image.name}</option>)}
                  </select>}
                </div>
              ))}
            </div>
          ))}
          <button
            onClick={() => onChange([...items, createEmptyItem()])}
            className="text-[10px] text-green hover:text-green-dim transition-colors"
          >
            + Add item
          </button>
        </div>
      )
    }

    default:
      return null
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-border-subtle">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-3 hover:text-text-2 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-3.5 pb-3">{children}</div>}
    </div>
  )
}

export function PropertiesPanel({ block }: { block: BlockConfig }) {
  const [showJson, setShowJson] = useState(false)
  const updateBlock = useConfigStore((state) => state.updateBlock)
  const schema = Object.hasOwn(blockFields, block.type) ? blockFields[block.type] : undefined

  return (
    <>
      {/* Header */}
      <div className="px-3.5 py-3 border-b border-border-default flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-2">
          Properties
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-glow text-green font-semibold">
          {block.type}
        </span>
      </div>

      {/* Property sections */}
      {schema?.sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.fields.filter(field => !(block.type === 'footer' && ((block.variant === 'minimal' && ['logo', 'logoImage'].includes(field.key)) || (block.variant !== 'multi-column' && field.key === 'description')))).map((field) => (
            <PropertyField key={field.key} field={field} block={block} />
          ))}
        </Section>
      )) || (
        <div className="p-3.5 text-[11px] text-text-3">
          No editable properties defined for this block type.
        </div>
      )}

      <Section title="Screen visibility">
        <p className="mb-2 text-[11px] text-text-3">Choose the screen sizes where this section appears.</p>
        {(['mobile', 'tablet', 'desktop'] as const).map(device => <label key={device} className="flex items-center gap-2 py-1 text-xs text-text-1">
          <input type="checkbox" checked={!block.webstudioHiddenOn?.[device]} onChange={event => updateBlock(block.id, {
            webstudioHiddenOn: { ...block.webstudioHiddenOn, [device]: !event.target.checked },
          })} /> Show on {device}
        </label>)}
        <p className="mt-2 text-[10px] text-text-3">Hidden sections stay available while editing.</p>
      </Section>

      {/* View JSON toggle */}
      <div className="border-t border-border-subtle">
        <button
          onClick={() => setShowJson(!showJson)}
          className="w-full px-3.5 py-2 flex items-center gap-1.5 text-[10px] text-text-3 hover:text-text-2 transition-colors"
        >
          <Code size={11} />
          {showJson ? 'Hide' : 'View'} Block JSON
        </button>
        {showJson && (
          <pre className="px-3.5 pb-3 text-[10px] font-mono text-text-2 leading-relaxed overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify({ id: block.id, type: block.type, variant: block.variant, props: block.props }, null, 2)}
          </pre>
        )}
      </div>
    </>
  )
}
