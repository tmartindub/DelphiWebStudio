import type { DesktopCapability } from './bridge-protocol'

type NativeMessage = Record<string, unknown>
type NativeWebView = {
  postMessage(message: NativeMessage): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

/** Authorizes an existing local flow; no file paths or content cross this bridge. */
export async function requestDesktopAction(capability: DesktopCapability, projectId: string | null): Promise<void> {
  if (window.location.hostname !== 'webstudio.local') return
  if ((projectId === null && capability !== 'project.open') || (projectId !== null && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(projectId))) throw new Error('Open a project before continuing.')
  const webview = (window as unknown as { chrome?: { webview?: NativeWebView } }).chrome?.webview
  if (!webview) throw new Error('The desktop bridge is unavailable.')

  function exchange(message: NativeMessage): Promise<NativeMessage> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => { webview!.removeEventListener('message', receive); reject(new Error('The desktop request timed out.')) }, 5000)
      function receive(event: MessageEvent) {
        const data: unknown = event.data
        if (!data || typeof data !== 'object' || Array.isArray(data)) return
        const reply = data as NativeMessage
        if (reply.version !== 1 || reply.requestId !== message.requestId) return
        window.clearTimeout(timer)
        webview!.removeEventListener('message', receive)
        resolve(reply)
      }
      webview!.addEventListener('message', receive)
      try { webview!.postMessage(message) } catch {
        window.clearTimeout(timer)
        webview!.removeEventListener('message', receive)
        reject(new Error('The desktop request could not be sent.'))
      }
    })
  }

  const opened = await exchange({ version: 1, kind: 'session.open', requestId: crypto.randomUUID(), projectId, capability })
  if (opened.kind !== 'session.open' || opened.projectId !== projectId || opened.capability !== capability || typeof opened.sessionId !== 'string' || !/^[0-9a-f]{64}$/.test(opened.sessionId)) throw new Error('The desktop session was rejected.')
  const reply = await exchange({ version: 1, requestId: crypto.randomUUID(), sessionId: opened.sessionId, projectId, capability })
  if (reply.capability !== capability || reply.ok !== true) throw new Error('The desktop request was rejected.')
}
