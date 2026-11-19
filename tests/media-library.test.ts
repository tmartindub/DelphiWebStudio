import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { ProjectMediaLibrary } from '../src/media/media-library'

describe('project media library', () => {
  it('imports original PDF bytes, identifies duplicates and isolates projects', async () => {
    const library = new ProjectMediaLibrary()
    const projectId = crypto.randomUUID()
    const pdf = new File(['%PDF-1.7\nexample'], 'bulletin.pdf', { type: 'application/pdf' })
    const first = await library.import(projectId, pdf)
    const duplicate = await library.import(projectId, pdf)
    expect(first.duplicate).toBe(false)
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.asset.id).toBe(first.asset.id)
    expect(await first.asset.content.text()).toBe('%PDF-1.7\nexample')
    expect(first.asset.path).toMatch(/^assets\/[a-f0-9-]+-bulletin\.pdf$/)
    expect(first.asset.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(await library.list(projectId)).toHaveLength(1)
    expect(await library.list(crypto.randomUUID())).toHaveLength(0)
  })

  it('rejects mismatched or active file types without modifying the library', async () => {
    const library = new ProjectMediaLibrary()
    const projectId = crypto.randomUUID()
    await expect(library.import(projectId, new File(['not a PDF'], 'bad.pdf'))).rejects.toThrow('contents do not match')
    await expect(library.import(projectId, new File(['<svg onload="alert(1)"/>'], 'bad.svg'))).rejects.toThrow('SVG')
    expect(await library.list(projectId)).toEqual([])
  })

  it('requires opt-in for ZIP files and stores them as downloads without extracting them', async () => {
    const library = new ProjectMediaLibrary()
    const projectId = crypto.randomUUID()
    const file = new File([new Uint8Array([80, 75, 5, 6, 0, 0])], 'archive.zip')
    await expect(library.import(projectId, file)).rejects.toThrow('enabled')
    const result = await library.import(projectId, file, undefined, false, true)
    expect(result.asset.mime).toBe('application/zip')
  })

  it('does not allow one project to remove another project’s asset', async () => {
    const library = new ProjectMediaLibrary()
    const projectId = crypto.randomUUID()
    const { asset } = await library.import(projectId, new File(['hello'], 'note.txt'))
    await expect(library.remove(crypto.randomUUID(), asset.id)).rejects.toThrow('not found')
    expect(await library.list(projectId)).toHaveLength(1)
  })

  it('restores the same portable asset identity in a separate project and verifies checksums', async () => {
    const library = new ProjectMediaLibrary()
    const firstProject = crypto.randomUUID()
    const secondProject = crypto.randomUUID()
    const file = new File(['hello'], 'note.txt')
    const { asset } = await library.import(firstProject, file)
    const restored = await library.import(secondProject, file, asset)
    expect(restored.asset.id).toBe(asset.id)
    expect(restored.asset.path).toBe(asset.path)
    expect(await library.list(firstProject)).toHaveLength(1)
    expect(await library.list(secondProject)).toHaveLength(1)
    await expect(library.import(crypto.randomUUID(), new File(['changed'], 'note.txt'), asset)).rejects.toThrow('checksum')
  })

  it('replaces and undoes an asset without changing its identity or path', async () => {
    const library = new ProjectMediaLibrary()
    const projectId = crypto.randomUUID()
    const { asset } = await library.import(projectId, new File(['old text'], 'note.txt'))
    const bytes = new TextEncoder().encode('new text')
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('')
    const replacement = await library.import(projectId, new File([bytes], 'note.txt'), { id: asset.id, path: asset.path, sha256 }, true)
    expect(replacement.asset.id).toBe(asset.id)
    expect(replacement.asset.path).toBe(asset.path)
    expect(await replacement.asset.content.text()).toBe('new text')
    await library.undoReplacement(projectId, asset.id)
    expect(await (await library.list(projectId))[0].content.text()).toBe('old text')
  })

  it('renames a batch atomically while preserving references and permits undo', async () => {
    const library = new ProjectMediaLibrary()
    const projectId = crypto.randomUUID()
    const first = (await library.import(projectId, new File(['one'], 'one.txt'))).asset
    const second = (await library.import(projectId, new File(['two'], 'two.txt'))).asset
    await expect(library.rename(projectId, [{ id: first.id, name: 'valid.txt' }, { id: second.id, name: '../bad.txt' }])).rejects.toThrow('Names')
    expect((await library.list(projectId)).find(asset => asset.id === first.id)?.name).toBe('one.txt')
    await library.rename(projectId, [{ id: first.id, name: 'batch-1.txt' }, { id: second.id, name: 'batch-2.txt' }])
    const renamed = await library.list(projectId)
    expect(renamed.find(asset => asset.id === first.id)?.path).toBe(first.path)
    expect(renamed.find(asset => asset.id === second.id)?.name).toBe('batch-2.txt')
    await library.undoRenames(projectId, [first.id, second.id])
    expect((await library.list(projectId)).find(asset => asset.id === first.id)?.name).toBe('one.txt')
  })
})
