import JSZip from 'jszip'
import crc32 from 'jszip/lib/crc32.js'

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

/** Compare a saved destination backup with a separately captured destination scan. */
export async function createRestorePlan(backupZip: Blob, destination: unknown) {
  const current = validateWebsiteManifest(destination)
  if (backupZip.size > 520 * 1024 * 1024) throw new Error('The backup ZIP exceeds the 520 MiB limit.')
  const archive = await JSZip.loadAsync(await backupZip.arrayBuffer())
  const entries = Object.values(archive.files).filter(entry => !entry.dir)
  if (entries.length > 10000) throw new Error('The backup contains too many files.')
  const files: WebsiteFile[] = []
  let total = 0
  for (const entry of entries) {
    if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name) throw new Error('The backup contains an unsafe path.')
    const mode = typeof entry.unixPermissions === 'string' ? parseInt(entry.unixPermissions, 8) : entry.unixPermissions
    if (typeof mode === 'number' && (mode & 0o170000) === 0o120000) throw new Error('The backup contains a symbolic link.')
    const metadata = (entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number; crc32?: number } })._data
    // JSZip normalizes zero-length ZIP entries to an empty Promise and discards their metadata.
    const expectedSize = metadata instanceof Promise ? 0 : metadata?.uncompressedSize
    const expectedCrc = metadata instanceof Promise ? 0 : metadata?.crc32
    if (!Number.isSafeInteger(expectedSize) || expectedSize! < 0 || expectedSize! > 64 * 1024 * 1024 || !Number.isInteger(expectedCrc)) throw new Error('The backup contains a file that is too large or has invalid metadata.')
    total += expectedSize!
    if (total > 512 * 1024 * 1024) throw new Error('The backup exceeds the 512 MiB expanded size limit.')
    const bytes = await entry.async('uint8array')
    if (bytes.length !== expectedSize || (crc32(bytes) >>> 0) !== (expectedCrc! >>> 0)) throw new Error('The backup is damaged; a file checksum does not match.')
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
    files.push({ path: entry.name, size: bytes.length, sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') })
  }
  const backup = validateWebsiteManifest({ format: 'webstudio-website-manifest', version: 1, files })
  return compareWebsiteManifests(current, backup)
}

/** Review desired files only after the backup matches the supplied destination scan. */
export async function createDeploymentPlan(websiteZip: Blob, destination: unknown, backupZip: Blob) {
  const current = validateWebsiteManifest(destination)
  const backupDifference = await createRestorePlan(backupZip, current)
  if (backupDifference.added.length || backupDifference.changed.length || backupDifference.removed.length) {
    throw new Error('The backup does not match the destination scan. Scan and back up the same destination again.')
  }
  return compareWebsiteManifests(current, await createWebsiteManifest(websiteZip))
}
