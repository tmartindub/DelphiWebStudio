import { afterEach, describe, expect, it, vi } from 'vitest'
import { geminiSession, generateSiteConfig } from '../src/lib/generate-site'

afterEach(() => {
  geminiSession.key = ''
  geminiSession.changed = false
  geminiSession.cloudEnabled = false
  vi.unstubAllGlobals()
})

describe('Gemini session key', () => {
  it('uses a newly entered session key without reading the older stored key', async () => {
    const getItem = vi.fn(() => 'old-synthetic-key')
    const fetch = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    vi.stubGlobal('localStorage', { getItem })
    vi.stubGlobal('fetch', fetch)
    geminiSession.key = 'new-synthetic-key'
    geminiSession.changed = true
    geminiSession.cloudEnabled = true
    await expect(generateSiteConfig('fictional brief')).rejects.toMatchObject({ name: 'AbortError' })
    expect(getItem).not.toHaveBeenCalled()
    expect(fetch.mock.calls[0][0]).toContain('new-synthetic-key')
  })

  it('keeps an existing saved key usable until the user changes or removes it', async () => {
    const getItem = vi.fn(() => 'old-synthetic-key')
    const fetch = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    vi.stubGlobal('localStorage', { getItem })
    vi.stubGlobal('fetch', fetch)
    geminiSession.cloudEnabled = true
    await expect(generateSiteConfig('fictional brief')).rejects.toMatchObject({ name: 'AbortError' })
    expect(getItem).toHaveBeenCalledWith('openpage-gemini-key')
    expect(fetch.mock.calls[0][0]).toContain('old-synthetic-key')
  })

  it('uses a local template without accessing a key or making a request by default', async () => {
    const getItem = vi.fn(() => 'old-synthetic-key')
    const fetch = vi.fn()
    vi.stubGlobal('localStorage', { getItem })
    vi.stubGlobal('fetch', fetch)
    const result = await generateSiteConfig('fictional community site')
    expect(result.source).toBe('template')
    expect(getItem).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
