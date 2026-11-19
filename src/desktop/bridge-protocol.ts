/** Request validation only. No native bridge or filesystem access is installed by this module. */
export type DesktopCapability = 'project.open' | 'project.save' | 'media.import' | 'site.export'

export interface DesktopRequest {
  version: 1
  requestId: string
  sessionId: string
  projectId: string | null
  capability: DesktopCapability
}

export interface DesktopSession {
  sessionId: string
  projectId: string | null
  granted: ReadonlySet<DesktopCapability>
}

/** senderUrl must come from the WebView event, never from the message body. */
export function validateDesktopRequest(raw: string, senderUrl: string, session: DesktopSession): DesktopRequest {
  if (new TextEncoder().encode(raw).byteLength > 16_384) throw new Error('Desktop request is too large.')
  let sender: URL
  try { sender = new URL(senderUrl) } catch { throw new Error('Untrusted desktop message source.') }
  if (sender.origin !== 'https://webstudio.local' || sender.username || sender.password) throw new Error('Untrusted desktop message source.')
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('Invalid desktop request JSON.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid desktop request.')
  const request = value as Record<string, unknown>
  const fields = ['version', 'requestId', 'sessionId', 'projectId', 'capability']
  if (Object.keys(request).length !== fields.length || fields.some(field => !Object.hasOwn(request, field))) throw new Error('Invalid desktop request fields.')
  if (request.version !== 1 || typeof request.requestId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(request.requestId) || Object.hasOwn(Object.prototype, request.requestId)) throw new Error('Invalid desktop request identity.')
  if (!session.sessionId || request.sessionId !== session.sessionId) throw new Error('Desktop session does not match.')
  if (request.projectId !== session.projectId) throw new Error('Desktop project does not match.')
  const allowed: DesktopCapability[] = ['project.open', 'project.save', 'media.import', 'site.export']
  if (typeof request.capability !== 'string' || !allowed.includes(request.capability as DesktopCapability) || !session.granted.has(request.capability as DesktopCapability)) throw new Error('Desktop capability is not granted.')
  if (request.capability !== 'project.open' && !session.projectId) throw new Error('No project is open.')
  return request as unknown as DesktopRequest
}
