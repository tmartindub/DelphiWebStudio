import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestDesktopExport } from '../src/desktop/native-export'

afterEach(() => vi.unstubAllGlobals())

describe('desktop export bridge', () => {
  it('leaves browser exports independent of the desktop bridge', async () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } })
    await expect(requestDesktopExport(null)).resolves.toBeUndefined()
  })

  it('opens a project-bound session and requests only local export', async () => {
    const messages: Record<string, unknown>[] = []
    let listener: ((event: MessageEvent) => void) | undefined
    const webview = {
      addEventListener: (_: string, value: (event: MessageEvent) => void) => { listener = value },
      removeEventListener: () => { listener = undefined },
      postMessage: (message: Record<string, unknown>) => {
        messages.push(message)
        const data = message.kind === 'session.open'
          ? { version: 1, kind: 'session.open', requestId: message.requestId, projectId: message.projectId, sessionId: 'a'.repeat(64) }
          : { version: 1, requestId: message.requestId, capability: 'site.export', ok: true }
        queueMicrotask(() => listener?.({ data } as MessageEvent))
      },
    }
    vi.stubGlobal('window', { location: { hostname: 'webstudio.local' }, setTimeout, clearTimeout, chrome: { webview } })
    await expect(requestDesktopExport('project-1')).resolves.toBeUndefined()
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ kind: 'session.open', projectId: 'project-1' })
    expect(messages[1]).toMatchObject({ capability: 'site.export', projectId: 'project-1', sessionId: 'a'.repeat(64) })
    expect(Object.keys(messages[1]).sort()).toEqual(['capability', 'projectId', 'requestId', 'sessionId', 'version'])
  })

  it('fails closed if a desktop bridge or valid session is unavailable', async () => {
    vi.stubGlobal('window', { location: { hostname: 'webstudio.local' }, setTimeout, clearTimeout })
    await expect(requestDesktopExport('project-1')).rejects.toThrow('bridge is unavailable')
    await expect(requestDesktopExport(null)).rejects.toThrow('Open a project')
  })
})
