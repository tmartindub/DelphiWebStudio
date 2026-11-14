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
})
