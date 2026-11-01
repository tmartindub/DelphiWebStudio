type NativeMessage = Record<string, unknown>
type NativeWebView = {
  postMessage(message: NativeMessage): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

/** Authorizes the existing local export flow; no file paths or content cross this bridge. */
export async function requestDesktopExport(projectId: string | null): Promise<void> {
  if (window.location.hostname !== 'webstudio.local') return
  if (!projectId || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(projectId)) throw new Error('Open a project before exporting.')
  const webview = (window as unknown as { chrome?: { webview?: NativeWebView } }).chrome?.webview
  if (!webview) throw new Error('The desktop export bridge is unavailable.')

  function exchange(message: NativeMessage): Promise<NativeMessage> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => { webview!.removeEventListener('message', receive); reject(new Error('The desktop export request timed out.')) }, 5000)
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
        reject(new Error('The desktop export request could not be sent.'))
      }
    })
  }

  const opened = await exchange({ version: 1, kind: 'session.open', requestId: crypto.randomUUID(), projectId })
  if (opened.kind !== 'session.open' || opened.projectId !== projectId || typeof opened.sessionId !== 'string' || !/^[0-9a-f]{64}$/.test(opened.sessionId)) throw new Error('The desktop export session was rejected.')
  const reply = await exchange({ version: 1, requestId: crypto.randomUUID(), sessionId: opened.sessionId, projectId, capability: 'site.export' })
  if (reply.capability !== 'site.export' || reply.ok !== true) throw new Error('The desktop export request was rejected.')
}
