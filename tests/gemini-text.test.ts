import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestGeminiCredential } from '../src/desktop/native-bridge'
import { GEMINI_TEXT_MODEL, suggestSelectedText } from '../src/lib/gemini-text'

vi.mock('../src/desktop/native-bridge', () => ({ requestGeminiCredential: vi.fn() }))
const selected = [{ id: 's0', text: 'Welcom to ' }, { id: 's1', text: 'our community', breakBefore: false }]
const permission = { consent: true, freeTierConfirmed: true }
const success = (segments = [{ id: 's0', text: 'Welcome to ' }, { id: 's1', text: 'our community' }]) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ segments }) }] } }] }))
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })

describe('Gemini selected-text requests', () => {
  it('requires sharing consent and a confirmed unbilled project before accessing the saved key', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(suggestSelectedText(selected, 'Correct spelling.', { ...permission, consent: false })).rejects.toThrow('Free tier')
    await expect(suggestSelectedText(selected, 'Correct spelling.', { ...permission, freeTierConfirmed: false })).rejects.toThrow('Free tier')
    expect(requestGeminiCredential).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })

  it('uses only the saved Windows key and selected text, with one free-tier model and no enabled tools', async () => {
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-secret')
    const fetch = vi.fn().mockResolvedValue(success()); vi.stubGlobal('fetch', fetch)
    const result = await suggestSelectedText(selected, 'Correct spelling.', permission)
    expect(result).toEqual([{ id: 's0', text: 'Welcome to ' }, { id: 's1', text: 'our community', breakBefore: false }])
    expect(selected[0].text).toBe('Welcom to ')
    expect(requestGeminiCredential).toHaveBeenCalledWith('read')
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`)
    expect(url).not.toContain('synthetic-secret')
    expect(options.headers['x-goog-api-key']).toBe('synthetic-secret')
    const payload = JSON.parse(options.body)
    expect(JSON.parse(payload.contents[0].parts[0].text)).toEqual({ instruction: 'Correct spelling.', segments: selected })
    expect(payload.tools).toBeUndefined()
    expect(payload.generationConfig.maxOutputTokens).toBe(8192)
  })

  it('reports a missing key without making a request', async () => {
    vi.mocked(requestGeminiCredential).mockResolvedValue(null)
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(suggestSelectedText(selected, 'Improve.', permission)).rejects.toThrow('No Google key is saved')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([401, 403, 404, 429, 500])('does not retry, use a template, or switch to another model after HTTP %i', async status => {
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-secret')
    const fetch = vi.fn().mockResolvedValue(new Response('secret detail must not be shown', { status })); vi.stubGlobal('fetch', fetch)
    await expect(suggestSelectedText(selected, 'Improve.', permission)).rejects.toThrow(status === 429 ? 'free quota' : status === 404 ? 'unavailable for this key' : status >= 500 ? 'temporarily unavailable' : 'Google rejected')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [{ id: 's1', text: 'Moved' }, { id: 's0', text: 'words' }],
    [{ id: 's0', text: 'Missing second run' }],
    [{ id: 's0', text: '' }, { id: 's1', text: ' ' }],
    [{ id: 's0', text: '\u0000bad' }, { id: 's1', text: 'word' }],
  ])('rejects output that would damage formatting or clear the selection', async replacements => {
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-secret')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(success(replacements)))
    await expect(suggestSelectedText(selected, 'Improve.', permission)).rejects.toThrow('invalid suggestion')
  })

  it('rejects blocked or truncated output', async () => {
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-secret')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }))))
    await expect(suggestSelectedText(selected, 'Improve.', permission)).rejects.toThrow('complete suggestion')
  })

  it('honors cancellation without a network request or mutation', async () => {
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-secret')
    const controller = new AbortController(); controller.abort()
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(suggestSelectedText(selected, 'Improve.', { ...permission, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
