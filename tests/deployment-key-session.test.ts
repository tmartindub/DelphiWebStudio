import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../src/store/editorStore'
import { publishSite } from '../src/lib/publish-site'

afterEach(() => {
  useEditorStore.setState({ activeProjectId: null, deploymentKeys: {} })
  vi.unstubAllGlobals()
})

describe('deployment session key', () => {
  it('uses the active project session key without changing a saved legacy key', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://example.invalid', deploymentId: 'test' }) })
    vi.stubGlobal('fetch', fetch)
    useEditorStore.setState({ activeProjectId: 'project-a', deploymentKeys: { 'project-a': 'session-synthetic-key' } })
    const settings = { deployAccessKey: 'older-synthetic-key' }
    await publishSite({ projectId: 'project-a', config: { name: 'Test', blocks: [] }, settings })
    expect(fetch.mock.calls[0][1].headers['x-openpage-deploy-key']).toBe('session-synthetic-key')
    expect(settings.deployAccessKey).toBe('older-synthetic-key')
  })

  it('does not apply another project session key to the requested project', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://example.invalid', deploymentId: 'test' }) })
    vi.stubGlobal('fetch', fetch)
    useEditorStore.setState({ activeProjectId: 'project-a', deploymentKeys: { 'project-a': 'session-synthetic-key' } })
    await publishSite({ projectId: 'project-b', config: { name: 'Test', blocks: [] }, settings: { deployAccessKey: 'other-synthetic-key' } })
    expect(fetch.mock.calls[0][1].headers['x-openpage-deploy-key']).toBe('other-synthetic-key')
  })
})
