export interface MediaAsset {
  id: string
  projectId: string
  name: string
  path: string
  mime: string
  size: number
  sha256: string
  importedAt?: number
  folder?: string
  width?: number
  height?: number
  content: Blob
  previousVersion?: { content: Blob; sha256: string; size: number; width?: number; height?: number }
  previousName?: string
}

const fileTypes: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml',
  pdf: 'application/pdf', txt: 'text/plain', mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm', zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export class ProjectMediaLibrary {
  private database: Promise<IDBDatabase>

  constructor() {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open('webstudio-media', 3)
      request.onupgradeneeded = event => {
        let store: IDBObjectStore
        if (event.oldVersion < 2) {
          store = request.result.createObjectStore('assetsV2', { keyPath: ['projectId', 'id'] })
          store.createIndex('projectId', 'projectId')
          if (event.oldVersion === 1) {
            const cursor = request.transaction!.objectStore('assets').openCursor()
            cursor.onsuccess = () => { if (cursor.result) { store.put(cursor.result.value); cursor.result.continue() } }
          }
        } else {
          store = request.transaction!.objectStore('assetsV2')
        }
        store.createIndex('projectHash', ['projectId', 'sha256'])
      }
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
      request.onerror = () => reject(request.error ?? new Error('Media library could not be opened.'))
      request.onblocked = () => reject(new Error('Media library is blocked by another window.'))
    })
  }

  async list(projectId: string): Promise<MediaAsset[]> {
    const database = await this.database
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('assetsV2', 'readonly')
      const request = transaction.objectStore('assetsV2').index('projectId').getAll(projectId)
      request.onsuccess = () => resolve(request.result as MediaAsset[])
      request.onerror = () => reject(request.error ?? new Error('Media could not be read.'))
    })
  }

  async copyProject(sourceId: string, destinationId: string): Promise<void> {
    const database = await this.database
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('assetsV2', 'readwrite')
      const store = transaction.objectStore('assetsV2')
      const request = store.index('projectId').openCursor(IDBKeyRange.only(sourceId))
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        store.add({ ...cursor.value, projectId: destinationId })
        cursor.continue()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Project media could not be copied.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Project media copy was cancelled.'))
    })
  }

  async import(projectId: string, file: File, restored?: { id: string; path: string; sha256: string; importedAt?: number; folder?: string }, replacing = false, allowZip = false): Promise<{ asset: MediaAsset; duplicate: boolean }> {
    if (!projectId) throw new Error('Open a project before importing media.')
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    const mime = fileTypes[extension]
    if (!mime) throw new Error(`${file.name}: this file type is not supported yet.`)
    if (extension === 'zip' && !restored && !allowZip) throw new Error(`${file.name}: ZIP imports must be enabled first.`)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const header = Array.from(bytes.slice(0, 16))
    const ascii = String.fromCharCode(...header)
    const valid = extension === 'pdf' ? ascii.startsWith('%PDF-')
      : extension === 'svg' ? true
      : extension === 'png' ? header.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
      : extension === 'jpg' || extension === 'jpeg' ? header[0] === 255 && header[1] === 216 && header[2] === 255
      : extension === 'gif' ? ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')
      : extension === 'webp' ? ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
      : extension === 'avif' ? ascii.slice(4, 8) === 'ftyp' && /avif|avis/.test(String.fromCharCode(...bytes.slice(8, 64)))
      : ['docx', 'xlsx', 'pptx', 'zip'].includes(extension) ? ascii.startsWith('PK\u0003\u0004') || ascii.startsWith('PK\u0005\u0006')
      : extension === 'webm' ? header.slice(0, 4).join(',') === '26,69,223,163'
      : extension === 'mp4' ? ascii.slice(4, 8) === 'ftyp'
      : extension === 'mp3' ? ascii.startsWith('ID3') || (header[0] === 255 && (header[1] & 224) === 224)
      : !bytes.includes(0)
    if (!valid) throw new Error(`${file.name}: contents do not match the file type.`)
    if (extension === 'svg') {
      if (typeof DOMParser === 'undefined') throw new Error(`${file.name}: SVG validation is unavailable.`)
      const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error(`${file.name}: unsafe SVG declaration.`)
      const document = new DOMParser().parseFromString(source, 'image/svg+xml')
      const allowed = new Set(['svg', 'g', 'defs', 'title', 'desc', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'use', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask'])
      if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') throw new Error(`${file.name}: invalid SVG.`)
      for (const element of Array.from(document.querySelectorAll('*'))) {
        if (element.namespaceURI !== 'http://www.w3.org/2000/svg' || !allowed.has(element.localName)) throw new Error(`${file.name}: unsafe SVG element.`)
        for (const attribute of Array.from(element.attributes)) {
          const name = attribute.localName.toLowerCase()
          const value = attribute.value.trim()
          if (name.startsWith('on') || name === 'style' || (name === 'href' && !/^#[a-zA-Z0-9_.:-]+$/.test(value)) || /javascript\s*:|data\s*:/i.test(value) || (/url\s*\(/i.test(value) && !/^url\(#[a-zA-Z0-9_.:-]+\)$/.test(value))) {
            throw new Error(`${file.name}: unsafe SVG attribute.`)
          }
        }
      }
    }
    let width: number | undefined
    let height: number | undefined
    if (mime.startsWith('image/') && extension !== 'svg' && typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file)
        if (!bitmap.width || !bitmap.height) throw new Error('Empty image.')
        width = bitmap.width
        height = bitmap.height
        bitmap.close()
      } catch {
        throw new Error(`${file.name}: the image is damaged or unsupported by this browser.`)
      }
    }
    if (extension === 'pdf' && typeof window !== 'undefined') {
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      GlobalWorkerOptions.workerSrc = workerUrl
      const task = getDocument({ data: bytes.slice(), enableXfa: false })
      let passwordRequired = false
      task.onPassword = () => { passwordRequired = true; void task.destroy() }
      try { await task.promise } catch {
        if (!passwordRequired) throw new Error(`${file.name}: the PDF is damaged or unreadable.`)
      } finally { await task.destroy().catch(() => undefined) }
    }
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('')
    if (restored && (!/^[a-f0-9-]{36}$/i.test(restored.id) || !restored.path.startsWith(`assets/${restored.id}-`) || !/^assets\/[a-zA-Z0-9._-]+$/.test(restored.path) || restored.sha256 !== hash)) {
      throw new Error(`${file.name}: project media metadata or checksum is invalid.`)
    }
    const database = await this.database
    let previous: MediaAsset | undefined
    if (replacing && restored) {
      previous = await new Promise<MediaAsset | undefined>((resolve, reject) => {
        const request = database.transaction('assetsV2', 'readonly').objectStore('assetsV2').get([projectId, restored.id])
        request.onsuccess = () => resolve(request.result as MediaAsset | undefined)
        request.onerror = () => reject(request.error ?? new Error('Original media could not be read.'))
      })
      if (!previous || previous.path !== restored.path || previous.mime !== mime) throw new Error('The replacement must match an existing media type.')
    }
    const id = restored?.id ?? crypto.randomUUID()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-') || `file.${extension}`
    const folder = restored?.folder ?? (file.webkitRelativePath ?? '').split('/').slice(0, -1).join('/')
    if (folder && (folder.includes('\\') || folder.split('/').some(part => part === '..' || part === '.'))) throw new Error(`${file.name}: invalid folder path.`)
    const asset: MediaAsset = { id, projectId, name: previous?.name ?? file.name, path: restored?.path ?? `assets/${id}-${safeName}`, mime, size: file.size, sha256: hash, importedAt: previous?.importedAt ?? restored?.importedAt ?? Date.now(), ...((previous?.folder ?? folder) ? { folder: previous?.folder ?? folder } : {}), ...(previous?.previousName ? { previousName: previous.previousName } : {}), ...(width && height ? { width, height } : {}), content: new Blob([bytes], { type: mime }), ...(previous ? { previousVersion: { content: previous.content, sha256: previous.sha256, size: previous.size, width: previous.width, height: previous.height } } : {}) }
    let duplicate: MediaAsset | undefined
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('assetsV2', 'readwrite')
      const store = transaction.objectStore('assetsV2')
      let changed = false
      if (replacing) {
        const request = store.get([projectId, id])
        request.onsuccess = () => {
          const current = request.result as MediaAsset | undefined
          if (!current || !previous || current.sha256 !== previous.sha256 || current.size !== previous.size || current.name !== previous.name || current.path !== previous.path || current.mime !== previous.mime || current.width !== previous.width || current.height !== previous.height || current.folder !== previous.folder || current.importedAt !== previous.importedAt || current.previousVersion?.sha256 !== previous.previousVersion?.sha256 || current.previousVersion?.size !== previous.previousVersion?.size || current.previousVersion?.width !== previous.previousVersion?.width || current.previousVersion?.height !== previous.previousVersion?.height || current.previousName !== previous.previousName) {
            changed = true
            transaction.abort()
            return
          }
          store.put(asset)
        }
      } else if (!restored) {
        const request = store.index('projectHash').get([projectId, hash])
        request.onsuccess = () => {
          duplicate = request.result as MediaAsset | undefined
          if (!duplicate) store.add(asset)
        }
      } else store.add(asset)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(changed ? new Error('Media changed while it was being replaced. Try again.') : transaction.error ?? new Error('Media could not be saved.'))
      transaction.onabort = () => reject(changed ? new Error('Media changed while it was being replaced. Try again.') : transaction.error ?? new Error('Media import was cancelled.'))
    })
    return { asset: duplicate ?? asset, duplicate: !!duplicate }
  }

  async undoReplacement(projectId: string, id: string): Promise<void> {
    const database = await this.database
    const asset = await new Promise<MediaAsset | undefined>((resolve, reject) => {
      const request = database.transaction('assetsV2', 'readonly').objectStore('assetsV2').get([projectId, id])
      request.onsuccess = () => resolve(request.result as MediaAsset | undefined)
      request.onerror = () => reject(request.error ?? new Error('Media could not be read.'))
    })
    if (!asset?.previousVersion) throw new Error('No previous media version is available.')
    const previous = asset.previousVersion
    if (!(previous.content instanceof Blob) || previous.content.size !== previous.size || !/^[a-f0-9]{64}$/i.test(previous.sha256)) throw new Error('The previous media version failed its integrity check; the current file was kept.')
    const digest = await crypto.subtle.digest('SHA-256', await previous.content.arrayBuffer())
    const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    if (checksum !== previous.sha256.toLowerCase()) throw new Error('The previous media version failed its integrity check; the current file was kept.')
    let width = previous.width
    let height = previous.height
    if ((!width || !height) && asset.mime.startsWith('image/') && asset.mime !== 'image/svg+xml' && typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(previous.content)
        width = bitmap.width || undefined
        height = bitmap.height || undefined
        bitmap.close()
      } catch { width = undefined; height = undefined }
    }
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('assetsV2', 'readwrite')
      const store = transaction.objectStore('assetsV2')
      let changed = false
      const request = store.get([projectId, id])
      request.onsuccess = () => {
        const current = request.result as MediaAsset | undefined
        if (!current || current.sha256 !== asset.sha256 || current.previousVersion?.sha256 !== previous.sha256) {
          changed = true
          transaction.abort()
          return
        }
        store.put({ ...current, ...previous, width, height, previousVersion: undefined })
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(changed ? new Error('Media changed while the replacement was being undone. Try again.') : transaction.error ?? new Error('Media replacement could not be undone.'))
      transaction.onabort = () => reject(changed ? new Error('Media changed while the replacement was being undone. Try again.') : transaction.error ?? new Error('Media replacement could not be undone.'))
    })
  }

  async rename(projectId: string, changes: { id: string; name: string }[]): Promise<void> {
    if (new Set(changes.map(change => change.id)).size !== changes.length) throw new Error('A media file was selected more than once.')
    const database = await this.database
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('assetsV2', 'readwrite')
      const store = transaction.objectStore('assetsV2')
      let invalid = false
      for (const change of changes) {
        const request = store.get([projectId, change.id])
        request.onsuccess = () => {
          const asset = request.result as MediaAsset | undefined
          const name = change.name.trim()
          const extension = asset?.name.split('.').pop()?.toLowerCase()
          if (!asset || !name || /[\\/\p{Cc}]/u.test(name) || name.split('.').pop()?.toLowerCase() !== extension) {
            invalid = true
            transaction.abort()
            return
          }
          store.put({ ...asset, name, previousName: asset.name })
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(invalid ? new Error('Names must be nonempty, keep their original extension, and contain no path separators.') : transaction.error ?? new Error('Media could not be renamed.'))
      transaction.onabort = () => reject(invalid ? new Error('Names must be nonempty, keep their original extension, and contain no path separators.') : transaction.error ?? new Error('Media rename was cancelled.'))
    })
  }

  async undoRenames(projectId: string, ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) throw new Error('A media file was selected more than once.')
    const database = await this.database
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('assetsV2', 'readwrite')
      const store = transaction.objectStore('assetsV2')
      let unavailable = false
      for (const id of ids) {
        const request = store.get([projectId, id])
        request.onsuccess = () => {
          const asset = request.result as MediaAsset | undefined
          if (!asset?.previousName) {
            unavailable = true
            transaction.abort()
            return
          }
          store.put({ ...asset, name: asset.previousName, previousName: undefined })
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(unavailable ? new Error('A previous media name is unavailable.') : transaction.error ?? new Error('Media rename could not be undone.'))
      transaction.onabort = () => reject(unavailable ? new Error('A previous media name is unavailable.') : transaction.error ?? new Error('Media rename was cancelled.'))
    })
  }

  async remove(projectId: string, id: string): Promise<void> {
    const database = await this.database
    const asset = await new Promise<MediaAsset | undefined>((resolve, reject) => {
      const request = database.transaction('assetsV2', 'readonly').objectStore('assetsV2').get([projectId, id])
      request.onsuccess = () => resolve(request.result as MediaAsset | undefined)
      request.onerror = () => reject(request.error ?? new Error('Media could not be read.'))
    })
    if (!asset) throw new Error('Media file not found in this project.')
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('assetsV2', 'readwrite')
      transaction.objectStore('assetsV2').delete([projectId, id])
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Media could not be removed.'))
    })
  }
}
