import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/desktop/native-bridge', () => ({ requestGeminiCredential: vi.fn() }))
import { requestGeminiCredential } from '@/desktop/native-bridge'
import { generateEditPlan } from '@/ai/gemini-edit-request'
import type { SiteConfig } from '@/blocks/types'
const blocks = [{ id: 'panel', type: 'panel' as const, variant: 'default', props: { title: 'Public supplied text', apiKey: 'PRIVATE_SECRET', formEndpoint: 'PRIVATE_ENDPOINT' } }]
const config: SiteConfig = { name: 'Synthetic', blocks, pages: [{ id: 'home', name: 'Home', path: '/', blocks }, { id: 'other', name: 'Other', path: '/other', blocks: [{ id: 'other-content', type: 'content', variant: 'prose', props: { body: 'PRIVATE_OTHER_CONTENT' } }] }] }
const scope = { pageId: 'home', target: 'block:panel' }
const options = () => ({ consent: true, freeTierConfirmed: true, history: [], signal: new AbortController().signal })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.mocked(requestGeminiCredential).mockReset() })
describe('reviewed Gemini edit requests', () => {
  it('requires both confirmations before credential access or network use', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(generateEditPlan(config, scope, 'Make it blue', { ...options(), consent: false })).rejects.toThrow('Confirm')
    await expect(generateEditPlan(config, scope, 'Make it blue', { ...options(), freeTierConfirmed: false })).rejects.toThrow('Confirm')
    expect(requestGeminiCredential).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('sends only approved metadata and bounded conversation using the saved header credential', async () => {
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-key')
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ summary: 'Reviewed edit', operations: [] }) }] } }] }))); vi.stubGlobal('fetch', fetch)
    await generateEditPlan(config, scope, 'Make it blue', { ...options(), media: [{ id: 'photo', name: 'Photo.png', folder: 'Photos', mime: 'image/png', path: 'assets/private-local-path.png' }], history: [{ request: 'Earlier request', result: 'Earlier preview', state: 'undone' }] })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, request] = fetch.mock.calls[0]
    expect(url).toContain('/gemini-3.5-flash-lite:generateContent'); expect(url).not.toContain('synthetic-key'); expect(request.headers['x-goog-api-key']).toBe('synthetic-key')
    expect(request.body).not.toMatch(/PRIVATE_SECRET|PRIVATE_ENDPOINT|PRIVATE_OTHER_CONTENT|private-local-path/)
    const body = JSON.parse(request.body), payload = JSON.parse(body.contents[0].parts[0].text)
    expect(body.tools).toBeUndefined(); expect(payload.recentConversation[0].state).toBe('undone'); expect(payload.context.media[0].folder).toBe('Photos')
  })
  it('does not retry or select another service after quota exhaustion', async () => {
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-key')
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 429 })); vi.stubGlobal('fetch', fetch)
    await expect(generateEditPlan(config, scope, 'Make it blue', options())).rejects.toThrow('free quota')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
