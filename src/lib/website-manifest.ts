import JSZip from 'jszip'

export interface WebsiteFile {
  path: string
  size: number
  sha256: string
}

export interface WebsiteManifest {
  format: 'webstudio-website-manifest'
  version: 1
  files: WebsiteFile[]
}

/** Validate file metadata before it is used in a local deployment comparison. */
export function validateWebsiteManifest(value: unknown): WebsiteManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid website manifest.')
  const manifest = value as Record<string, unknown>
  if (manifest.format !== 'webstudio-website-manifest' || manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length > 10000) throw new Error('Unsupported website manifest.')
  const paths = new Set<string>()
  const files = manifest.files.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid website file entry.')
    const file = entry as Record<string, unknown>
    if (typeof file.path !== 'string' || !file.path || file.path.startsWith('/') || /[\\:\p{Cc}]/u.test(file.path) || file.path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid website file path.')
    const key = file.path.toLowerCase()
    if (paths.has(key)) throw new Error('Duplicate website file path.')
    paths.add(key)
    if (!Number.isSafeInteger(file.size) || (file.size as number) < 0 || typeof file.sha256 !== 'string' || !/^[a-f\d]{64}$/i.test(file.sha256)) throw new Error('Invalid website file size or checksum.')
    return { path: file.path, size: file.size as number, sha256: file.sha256.toLowerCase() }
  })
  if ([...paths].some(path => {
    const parts = path.split('/')
    return parts.some((_, index) => index > 0 && paths.has(parts.slice(0, index).join('/')))
  })) throw new Error('Website file and folder paths conflict.')
  return { format: 'webstudio-website-manifest', version: 1, files: files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) }
}

/** Create a snapshot from the already prepared website ZIP. No network access is used. */
export async function createWebsiteManifest(zip: Blob): Promise<WebsiteManifest> {
  const archive = await JSZip.loadAsync(await zip.arrayBuffer())
  const files: WebsiteFile[] = []
  if (Object.values(archive.files).filter(entry => !entry.dir).length > 10000) throw new Error('The website has too many files for one manifest.')
  for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue
    if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name) throw new Error('Unsafe website ZIP path.')
    const data = await entry.async('arraybuffer')
    const digest = await crypto.subtle.digest('SHA-256', data)
    files.push({ path: entry.name, size: data.byteLength, sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') })
  }
  return validateWebsiteManifest({ format: 'webstudio-website-manifest', version: 1, files })
}

/** Compare two snapshots only; callers must not treat this as a live server scan. */
export function compareWebsiteManifests(previous: WebsiteManifest, current: WebsiteManifest) {
  const oldFiles = new Map(validateWebsiteManifest(previous).files.map(file => [file.path, file]))
  const newFiles = new Map(validateWebsiteManifest(current).files.map(file => [file.path, file]))
  return {
    added: [...newFiles.keys()].filter(path => !oldFiles.has(path)),
    changed: [...newFiles].filter(([path, file]) => oldFiles.has(path) && (oldFiles.get(path)!.size !== file.size || oldFiles.get(path)!.sha256 !== file.sha256)).map(([path]) => path),
    removed: [...oldFiles.keys()].filter(path => !newFiles.has(path)),
  }
}
