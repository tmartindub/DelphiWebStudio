import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
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

  it('restores the original image dimensions and recovers dimensions for older replacement records', async () => {
    const close = vi.fn()
    const decode = vi.fn().mockResolvedValueOnce({ width: 40, height: 20, close })
      .mockResolvedValueOnce({ width: 80, height: 60, close })
      .mockResolvedValueOnce({ width: 80, height: 60, close })
      .mockResolvedValueOnce({ width: 40, height: 20, close })
    vi.stubGlobal('createImageBitmap', decode)
    try {
      const library = new ProjectMediaLibrary()
      const projectId = crypto.randomUUID()
      const header = [137, 80, 78, 71, 13, 10, 26, 10]
      const original = (await library.import(projectId, new File([new Uint8Array([...header, 1])], 'image.png'))).asset
      const bytes = new Uint8Array([...header, 2])
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('')
      let replaced = (await library.import(projectId, new File([bytes], 'image.png'), { id: original.id, path: original.path, sha256 }, true)).asset
      expect([replaced.width, replaced.height]).toEqual([80, 60])
      expect([replaced.previousVersion?.width, replaced.previousVersion?.height]).toEqual([40, 20])
      await library.undoReplacement(projectId, original.id)
      expect([(await library.list(projectId))[0].width, (await library.list(projectId))[0].height]).toEqual([40, 20])
      replaced = (await library.import(projectId, new File([bytes], 'image.png'), { id: original.id, path: original.path, sha256 }, true)).asset

      // Older saved browser records did not retain the previous dimensions.
      delete replaced.previousVersion!.width
      delete replaced.previousVersion!.height
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('webstudio-media', 3)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('assetsV2', 'readwrite')
        transaction.objectStore('assetsV2').put(replaced)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      database.close()
      await library.undoReplacement(projectId, original.id)
      const restored = (await library.list(projectId))[0]
      expect([restored.width, restored.height]).toEqual([40, 20])
      expect(restored.sha256).toBe(original.sha256)
      expect(close).toHaveBeenCalledTimes(4)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does not overwrite a newer replacement while recovering older image metadata', async () => {
    const close = vi.fn()
    let finishDecode: (value: { width: number; height: number; close: () => void }) => void = () => {}
    const decode = vi.fn().mockResolvedValueOnce({ width: 40, height: 20, close })
      .mockResolvedValueOnce({ width: 80, height: 60, close })
      .mockImplementationOnce(() => new Promise(resolve => { finishDecode = resolve }))
      .mockResolvedValueOnce({ width: 100, height: 90, close })
    vi.stubGlobal('createImageBitmap', decode)
    try {
      const library = new ProjectMediaLibrary()
      const projectId = crypto.randomUUID()
      const header = [137, 80, 78, 71, 13, 10, 26, 10]
      const original = (await library.import(projectId, new File([new Uint8Array([...header, 1])], 'image.png'))).asset
      const second = new Uint8Array([...header, 2])
      const secondHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', second))).map(value => value.toString(16).padStart(2, '0')).join('')
      const replaced = (await library.import(projectId, new File([second], 'image.png'), { id: original.id, path: original.path, sha256: secondHash }, true)).asset
      delete replaced.previousVersion!.width
      delete replaced.previousVersion!.height
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('webstudio-media', 3)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('assetsV2', 'readwrite')
        transaction.objectStore('assetsV2').put(replaced)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      database.close()
      const undo = library.undoReplacement(projectId, original.id)
      await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(3))
      const third = new Uint8Array([...header, 3])
      const thirdHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', third))).map(value => value.toString(16).padStart(2, '0')).join('')
      await library.import(projectId, new File([third], 'image.png'), { id: original.id, path: original.path, sha256: thirdHash }, true)
      finishDecode({ width: 40, height: 20, close })
      await expect(undo).rejects.toThrow('Media changed')
      const current = (await library.list(projectId))[0]
      expect(current.sha256).toBe(thirdHash)
      expect([current.width, current.height]).toEqual([100, 90])
    } finally {
      vi.unstubAllGlobals()
    }
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
