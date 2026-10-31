import { describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { ProjectRevisions } from '../src/project/project-revisions'

describe('local project revisions', () => {
  it('keeps independent complete snapshots across library instances', async () => {
    const projectId = crypto.randomUUID()
    const otherId = crypto.randomUUID()
    const library = new ProjectRevisions()
    const first = await library.save(projectId, 'site.webstudio.json', new Blob(['first']))
    const second = await library.save(projectId, 'site.webstudio.zip', new Blob(['second'], { type: 'application/zip' }))
    await library.save(otherId, 'other.webstudio.json', new Blob(['other']))
    const restored = await new ProjectRevisions().list(projectId)
    expect(restored.map(item => item.id).sort()).toEqual([first.id, second.id].sort())
    expect(await restored.find(item => item.id === first.id)!.contents.text()).toBe('first')
    expect(await restored.find(item => item.id === second.id)!.contents.text()).toBe('second')
    expect(restored.find(item => item.id === second.id)!.filename).toBe('site.webstudio.zip')
    expect(await new ProjectRevisions().list(otherId)).toHaveLength(1)
    expect((await new ProjectRevisions().list()).filter(item => item.projectId === projectId || item.projectId === otherId)).toHaveLength(3)
  })

  it('rejects empty snapshots without changing existing revisions', async () => {
    const projectId = crypto.randomUUID()
    const library = new ProjectRevisions()
    await library.save(projectId, 'site.webstudio.json', new Blob(['original']))
    await expect(library.save(projectId, 'site.webstudio.json', new Blob())).rejects.toThrow('incomplete')
    await expect(library.save('', 'site.webstudio.json', new Blob(['x']))).rejects.toThrow('incomplete')
    expect(await library.list(projectId)).toHaveLength(1)
  })

  it('keeps earlier revisions when saving a new revision fails', async () => {
    const projectId = crypto.randomUUID()
    const library = new ProjectRevisions()
    await library.save(projectId, 'site.webstudio.json', new Blob(['original']))
    const add = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(() => { throw new DOMException('Storage full', 'QuotaExceededError') })
    try {
      await expect(library.save(projectId, 'site.webstudio.json', new Blob(['new']))).rejects.toThrow('Storage full')
    } finally { add.mockRestore() }
    const revisions = await library.list(projectId)
    expect(revisions).toHaveLength(1)
    expect(await revisions[0].contents.text()).toBe('original')
  })

  it('removes only the selected revision of the selected project', async () => {
    const projectId = crypto.randomUUID()
    const otherId = crypto.randomUUID()
    const library = new ProjectRevisions()
    const first = await library.save(projectId, 'site.webstudio.json', new Blob(['first']))
    const second = await library.save(projectId, 'site.webstudio.json', new Blob(['second']))
    const other = await library.save(otherId, 'other.webstudio.json', new Blob(['other']))
    await expect(library.remove(projectId, other.id)).rejects.toThrow('no longer available')
    await library.remove(projectId, first.id)
    expect((await library.list(projectId)).map(item => item.id)).toEqual([second.id])
    expect(await (await library.list(otherId))[0].contents.text()).toBe('other')
    await expect(library.remove(projectId, first.id)).rejects.toThrow('no longer available')
  })
})
