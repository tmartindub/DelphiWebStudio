export interface ProjectRevision {
  id: string
  projectId: string
  createdAt: number
  filename: string
  contents: Blob
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
    const revision: ProjectRevision = { id: crypto.randomUUID(), projectId, createdAt: Date.now(), filename, contents }
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

  async list(projectId: string): Promise<ProjectRevision[]> {
    const database = await this.database
    return new Promise((resolve, reject) => {
      const request = database.transaction('revisions', 'readonly').objectStore('revisions').index('projectId').getAll(projectId)
      request.onsuccess = () => resolve((request.result as ProjectRevision[]).sort((a, b) => b.createdAt - a.createdAt))
      request.onerror = () => reject(request.error ?? new Error('Local revisions could not be read.'))
    })
  }
}
