import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestDesktopAction } from '../src/desktop/native-bridge'
import type { DesktopCapability } from '../src/desktop/bridge-protocol'

afterEach(() => vi.unstubAllGlobals())

describe('desktop export bridge', () => {
  it('leaves browser exports independent of the desktop bridge', async () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } })
    await expect(requestDesktopAction('site.export', null)).resolves.toBeUndefined()
  })

  it.each<{ capability: DesktopCapability; projectId: string | null }>([
    { capability: 'project.open', projectId: null },
    { capability: 'project.open', projectId: 'project-1' },
    { capability: 'project.save', projectId: 'project-1' },
    { capability: 'media.import', projectId: 'project-1' },
    { capability: 'site.export', projectId: 'project-1' },
  ])('opens a session for only $capability', async ({ capability, projectId }) => {
    const messages: Record<string, unknown>[] = []
    let listener: ((event: MessageEvent) => void) | undefined
    const webview = {
      addEventListener: (_: string, value: (event: MessageEvent) => void) => { listener = value },
      removeEventListener: () => { listener = undefined },
      postMessage: (message: Record<string, unknown>) => {
        messages.push(message)
        const data = message.kind === 'session.open'
          ? { version: 1, kind: 'session.open', requestId: message.requestId, projectId: message.projectId, capability: message.capability, sessionId: 'a'.repeat(64) }
          : { version: 1, requestId: message.requestId, capability: message.capability, ok: true }
        queueMicrotask(() => listener?.({ data } as MessageEvent))
      },
    }
    vi.stubGlobal('window', { location: { hostname: 'webstudio.local' }, setTimeout, clearTimeout, chrome: { webview } })
    await expect(requestDesktopAction(capability, projectId)).resolves.toBeUndefined()
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ kind: 'session.open', projectId, capability })
    expect(messages[1]).toMatchObject({ capability, projectId, sessionId: 'a'.repeat(64) })
    expect(Object.keys(messages[1]).sort()).toEqual(['capability', 'projectId', 'requestId', 'sessionId', 'version'])
  })

  it('fails closed if a desktop bridge or valid session is unavailable', async () => {
    vi.stubGlobal('window', { location: { hostname: 'webstudio.local' }, setTimeout, clearTimeout })
    await expect(requestDesktopAction('site.export', 'project-1')).rejects.toThrow('bridge is unavailable')
    await expect(requestDesktopAction('site.export', null)).rejects.toThrow('Open a project')
  })
})
