import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { PropertiesPanel } from '../src/editor/PropertiesPanel'
import { RenderBlock } from '../src/blocks/registry'
import { useEditorStore } from '../src/store/editorStore'
import { useConfigStore } from '../src/store/configStore'
import { createProjectFile, parseProjectFile, serializeProjectFile } from '../src/project/project-file'
import { exportSiteToHTML } from '../src/lib/export-html'
import type { BlockConfig } from '../src/blocks/types'

const images = Array.from({ length: 49 }, (_, index) => ({ src: `/photo-${index + 1}.jpg`, alt: `Photo ${index + 1}`, caption: `Caption ${index + 1}`, assetId: `asset-${index + 1}` }))
const block: BlockConfig = { id: 'gallery', type: 'gallery', variant: 'responsive', props: { images, enablePhotoViewer: true } }

afterEach(() => { useEditorStore.getInitialState().selectedCompositeItem = null })

describe('gallery photo positions', () => {
  it('offers a bounded one-based position for the selected photo', () => {
    useEditorStore.getInitialState().selectedCompositeItem = { blockId: block.id, field: 'images', index: 48 }
    const html = renderToStaticMarkup(createElement(PropertiesPanel, { block }))
    expect(html).toContain('Photo 49 of 49')
    expect(html).toMatch(/aria-label="Photo 49 position"[^>]*min="1"[^>]*max="49"[^>]*value="49"/)
    expect(html).toContain('type="submit"')
    expect(html).not.toContain('Photo 1 position')
  })

  it('numbers photos only in the editor, not Preview or website output', () => {
    const editor = renderToStaticMarkup(createElement(RenderBlock, { block, editable: true }))
    const preview = renderToStaticMarkup(createElement(RenderBlock, { block }))
    expect(editor).toContain('data-gallery-position="49"')
    expect(preview).not.toContain('data-gallery-position')
    expect(exportSiteToHTML({ name: 'Photos', blocks: [block] })).not.toContain('data-gallery-position')
  })

  it('inserts the last photo at position 10 with its caption and media identity, saves the order and undoes it', () => {
    const config = { name: 'Photos', pages: [{ id: 'home', name: 'Home', path: '/', blocks: [block] }], blocks: [block] }
    useConfigStore.getState().setConfig(structuredClone(config))
    useConfigStore.getState().editBlockItems(block.id, 'images', 48, 9)
    const moved = useConfigStore.getState().config
    const expected = [...images.slice(0, 9), images[48], ...images.slice(9, 48)]
    expect(moved.pages![0].blocks[0].props.images).toEqual(expected)
    const reopened = parseProjectFile(serializeProjectFile(createProjectFile(moved, 'position-test'))).project.config
    expect(reopened.pages![0].blocks[0].props.images).toEqual(expected)
    const html = exportSiteToHTML({ ...reopened, blocks: reopened.pages![0].blocks })
    expect(html.indexOf('src="/photo-49.jpg"')).toBeLessThan(html.indexOf('src="/photo-10.jpg"'))
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config.pages![0].blocks[0].props.images).toEqual(images)
  })

  it('adds new photos as gallery entries with the same position and caption properties', () => {
    useConfigStore.getState().setConfig({ name: 'Photos', blocks: [structuredClone(block)] })
    const photo = { src: '/new-photo.jpg', assetId: 'new-photo', alt: 'New photo', caption: 'New caption' }
    expect(useConfigStore.getState().addGalleryImages(block.id, [photo])).toBe(49)
    const updated = useConfigStore.getState().getActivePageBlocks()[0]
    expect(updated.props.images).toEqual([...images, photo])
    expect(updated.props.section1Objects).toBeUndefined()
    useEditorStore.getInitialState().selectedCompositeItem = { blockId: block.id, field: 'images', index: 49 }
    const html = renderToStaticMarkup(createElement(PropertiesPanel, { block: updated }))
    expect(html).toContain('Photo 50 position')
    expect(html).toContain('New caption')
  })

  it('includes older unparented gallery images without losing captions, links, or media, and restores placement on undo', () => {
    const loose = { id: 'loose', type: 'image', src: '/loose.jpg', assetId: 'loose-asset', alt: 'Loose photo', caption: 'Old caption', url: '#history', x: 30, y: 400, width: 25, height: 160 }
    const panel = { id: 'panel', type: 'panel', text: 'Keep panel' }
    const child = { ...loose, id: 'child', parentId: panel.id }
    const placed = { id: 'legacy', mime: 'image/jpeg', src: '/legacy.jpg', name: 'Legacy photo', assetId: 'legacy-asset', x: 20, y: 50 }
    const pdf = { id: 'pdf', mime: 'application/pdf', src: '/document.pdf' }
    const original = { ...structuredClone(block), props: { ...block.props, section1Objects: [loose, panel, child], placedMedia: [placed, pdf] } }
    useConfigStore.getState().setConfig({ name: 'Photos', blocks: [original] })
    expect(useConfigStore.getState().addGalleryImages(block.id, [], true)).toBe(49)
    const updated = useConfigStore.getState().getActivePageBlocks()[0]
    expect(updated.props.images).toEqual([...images,
      { src: '/loose.jpg', assetId: 'loose-asset', alt: 'Loose photo', caption: 'Old caption', url: '#history' },
      { src: '/legacy.jpg', alt: 'Legacy photo', assetId: 'legacy-asset' },
    ])
    expect(updated.props.section1Objects).toEqual([panel, child])
    expect(updated.props.placedMedia).toEqual([pdf])
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().getActivePageBlocks()[0]).toEqual(original)
  })
})
