export interface ProjectRevision {
  id: string
  projectId: string
  createdAt: number
  filename: string
  contents: Blob
  sha256?: string
}

export class ProjectRevisions {
  private database: Promise<IDBDatabase>

  constructor() {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open('webstudio-project-revisions', 1)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('revisions', { keyPath: 'id' })
        store.createIndex('projectId', 'projectId')
      }
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
      request.onerror = () => reject(request.error ?? new Error('Local revisions could not be opened.'))
      request.onblocked = () => reject(new Error('Local revisions are blocked by another window.'))
    })
  }

  async save(projectId: string, filename: string, contents: Blob): Promise<ProjectRevision> {
    if (!projectId || !filename || !(contents instanceof Blob) || !contents.size) throw new Error('The revision is incomplete.')
    const digest = await crypto.subtle.digest('SHA-256', await contents.arrayBuffer())
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const revision: ProjectRevision = { id: crypto.randomUUID(), projectId, createdAt: Date.now(), filename, contents, sha256 }
    const database = await this.database
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('revisions', 'readwrite')
      transaction.objectStore('revisions').add(revision)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('The local revision could not be saved.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving the local revision was cancelled.'))
    })
    return revision
  }

  static async verify(revision: ProjectRevision): Promise<boolean> {
    if (!(revision.contents instanceof Blob) || !revision.contents.size) throw new Error('The local revision is incomplete.')
    if (revision.sha256 === undefined) return false
    if (!/^[a-f0-9]{64}$/.test(revision.sha256)) throw new Error('The local revision checksum is invalid.')
    const digest = await crypto.subtle.digest('SHA-256', await revision.contents.arrayBuffer())
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    if (actual !== revision.sha256) throw new Error('The local revision is damaged; its checksum does not match.')
    return true
  }

  async list(projectId?: string): Promise<ProjectRevision[]> {
    const database = await this.database
    return new Promise((resolve, reject) => {
      const store = database.transaction('revisions', 'readonly').objectStore('revisions')
      const request = projectId ? store.index('projectId').getAll(projectId) : store.getAll()
      request.onsuccess = () => resolve((request.result as ProjectRevision[]).sort((a, b) => b.createdAt - a.createdAt))
      request.onerror = () => reject(request.error ?? new Error('Local revisions could not be read.'))
    })
  }

  async remove(projectId: string, revisionId: string): Promise<void> {
    const database = await this.database
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('revisions', 'readwrite')
      const store = transaction.objectStore('revisions')
      let mismatch = false
      const request = store.get(revisionId)
      request.onsuccess = () => {
        const revision = request.result as ProjectRevision | undefined
        if (!revision || revision.projectId !== projectId) { mismatch = true; transaction.abort(); return }
        store.delete(revisionId)
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(mismatch ? new Error('The revision is no longer available.') : transaction.error ?? new Error('The revision could not be removed.'))
      transaction.onabort = () => reject(mismatch ? new Error('The revision is no longer available.') : transaction.error ?? new Error('Removing the revision was cancelled.'))
    })
  }
}
