import { describe, expect, it } from 'vitest'
import { validateDesktopRequest, type DesktopSession } from '../src/desktop/bridge-protocol'

const session: DesktopSession = { sessionId: 'session-1', projectId: 'project-1', granted: new Set(['project.save']) }
const request = { version: 1, requestId: 'request-1', sessionId: 'session-1', projectId: 'project-1', capability: 'project.save' }
const source = 'https://webstudio.local/editor'

describe('desktop request boundary', () => {
  it('accepts a granted operation from the trusted editor in the active project', () => {
    expect(validateDesktopRequest(JSON.stringify(request), source, session)).toEqual(request)
  })

  it.each(['https://webstudio.local.evil.test/editor', 'http://webstudio.local/editor', 'file:///editor', 'https://user@webstudio.local/editor', 'not a URL'])('rejects an untrusted source: %s', sender => {
    expect(() => validateDesktopRequest(JSON.stringify(request), sender, session)).toThrow('source')
  })

  it('rejects unknown fields, shell operations, other sessions, projects and ungranted operations', () => {
    for (const modified of [
      { ...request, path: 'C:/secret' }, { ...request, capability: 'shell.execute' },
      { ...request, capability: 'site.export' }, { ...request, sessionId: 'other' },
      { ...request, projectId: 'other' }, { ...request, version: 2 },
    ]) expect(() => validateDesktopRequest(JSON.stringify(modified), source, session)).toThrow()
  })

  it('requires an open project for project-scoped operations', () => {
    const emptySession: DesktopSession = { sessionId: 'session-1', projectId: null, granted: new Set(['project.open', 'project.save']) }
    expect(() => validateDesktopRequest(JSON.stringify({ ...request, projectId: null }), source, emptySession)).toThrow('No project')
    expect(validateDesktopRequest(JSON.stringify({ ...request, projectId: null, capability: 'project.open' }), source, emptySession).capability).toBe('project.open')
  })

  it('rejects malformed and oversized messages', () => {
    expect(() => validateDesktopRequest('{', source, session)).toThrow('JSON')
    expect(() => validateDesktopRequest('x'.repeat(16_385), source, session)).toThrow('large')
    expect(() => validateDesktopRequest(JSON.stringify({ ...request, requestId: '__proto__' }), source, session)).toThrow('identity')
  })
})
