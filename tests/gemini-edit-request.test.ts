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
  it('blocks missing or conflicting named targets before reading the key or sending a request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(generateEditPlan(config, scope, 'Change the hero background to yellow', options())).rejects.toThrow('No matching')
    const fixture = structuredClone(config)
    fixture.pages![0].blocks.push({ id: 'hero', type: 'hero', variant: 'minimal', props: { headline: 'Welcome', subheadline: 'Keep me' } }); fixture.blocks = fixture.pages![0].blocks
    await expect(generateEditPlan(fixture, scope, 'Change the hero background to yellow', options())).rejects.toThrow('currently selects')
    expect(requestGeminiCredential).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('sends only the uniquely named hero from a whole-page request and rejects a response that edits the lower block', async () => {
    const fixture = structuredClone(config)
    fixture.pages![0].blocks.unshift({ id: 'hero', type: 'hero', variant: 'minimal', props: { headline: 'Welcome', subheadline: 'Keep me' } }); fixture.blocks = fixture.pages![0].blocks
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-key')
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ summary: 'Color changed', operations: [{ action: 'set', target: 'block:panel', field: 'blockBackgroundColor', value: '"#ffff00"' }] }) }] } }] }))); vi.stubGlobal('fetch', fetch)
    await expect(generateEditPlan(fixture, { pageId: 'home', target: 'page:home' }, 'Change the hero section color to yellow', options())).rejects.toThrow('outside')
    expect(fetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetch.mock.calls[0][1].body), payload = JSON.parse(body.contents[0].parts[0].text)
    expect(payload.context.target).toBe('block:hero')
    expect(payload.context.requestedTarget).toMatchObject({ id: 'block:hero', explicit: true, backgroundOnly: true })
    expect(payload.context.targets.map((target: { id: string }) => target.id)).not.toContain('block:panel')
    expect(payload.context.instructions).toContain('only set operations on requestedTarget.id')
  })
  it('returns a valid hero background proposal without applying it or changing lower content', async () => {
    const fixture = structuredClone(config)
    fixture.pages![0].blocks.unshift({ id: 'hero', type: 'hero', variant: 'minimal', props: { headline: 'Welcome', subheadline: 'Keep me' } }); fixture.blocks = fixture.pages![0].blocks
    const original = structuredClone(fixture)
    vi.mocked(requestGeminiCredential).mockResolvedValue('synthetic-key')
    const response = { summary: 'Hero background changed to yellow', operations: [{ action: 'set', target: 'block:hero', field: 'blockBackgroundColor', value: '"#ffff00"' }] }
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(response) }] } }] }))); vi.stubGlobal('fetch', fetch)
    await expect(generateEditPlan(fixture, { pageId: 'home', target: 'page:home' }, 'Change the hero background to yellow', options())).resolves.toEqual(response)
    expect(fixture).toEqual(original)
  })
})
