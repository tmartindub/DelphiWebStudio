import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { compareWebsiteManifests, createWebsiteManifest, validateWebsiteManifest } from '../src/lib/website-manifest'

const hashA = 'a'.repeat(64)
const hashB = 'b'.repeat(64)
const manifest = (files: { path: string; size: number; sha256: string }[]) => ({ format: 'webstudio-website-manifest' as const, version: 1 as const, files })

describe('website deployment snapshots', () => {
  it('hashes the exact prepared ZIP files', async () => {
    const zip = new JSZip()
    zip.file('index.html', 'hello')
    const current = await createWebsiteManifest(await zip.generateAsync({ type: 'blob' }))
    expect(current.files).toEqual([{ path: 'index.html', size: 5, sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' }])
  })

  it('reports added, changed and removed paths without changing either snapshot', () => {
    const previous = manifest([{ path: 'old.html', size: 1, sha256: hashA }, { path: 'same.html', size: 1, sha256: hashA }, { path: 'changed.html', size: 1, sha256: hashA }])
    const current = manifest([{ path: 'new.html', size: 1, sha256: hashB }, { path: 'same.html', size: 1, sha256: hashA }, { path: 'changed.html', size: 1, sha256: hashB }])
    const before = structuredClone({ previous, current })
    expect(compareWebsiteManifests(previous, current)).toEqual({ added: ['new.html'], changed: ['changed.html'], removed: ['old.html'] })
    expect({ previous, current }).toEqual(before)
  })

  it.each(['../outside', '/absolute', 'folder/../outside', 'C:/outside', 'a\\outside'])('rejects unsafe path %s', path => {
    expect(() => validateWebsiteManifest(manifest([{ path, size: 1, sha256: hashA }]))).toThrow()
  })

  it('rejects duplicate paths, file-folder conflicts and malformed hashes', () => {
    expect(() => validateWebsiteManifest(manifest([{ path: 'Page.html', size: 1, sha256: hashA }, { path: 'page.html', size: 1, sha256: hashA }]))).toThrow('Duplicate')
    expect(() => validateWebsiteManifest(manifest([{ path: 'a', size: 1, sha256: hashA }, { path: 'a-b', size: 1, sha256: hashA }, { path: 'a/b', size: 1, sha256: hashA }]))).toThrow('conflict')
    expect(() => validateWebsiteManifest(manifest([{ path: 'ok', size: 1, sha256: 'bad' }]))).toThrow('checksum')
  })
})
