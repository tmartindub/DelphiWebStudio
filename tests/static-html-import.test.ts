import { describe, expect, it } from 'vitest'
import { importStaticHtml } from '../src/project/static-html-import'
import { parseProjectFile, serializeProjectFile } from '../src/project/project-file'

describe('static HTML import', () => {
  it('chooses the top-level index, keeps source inert, and preserves it on project round trip', () => {
    const files = [
      { path: 'site/sub/index.html', text: '<title>Nested</title><body>Nested page</body>' },
      { path: 'site/index.html', text: '<title>Home</title><body><p>Hello</p><script>evil()</script></body>' },
      { path: 'site/site.css', text: 'body { color: blue; }' },
    ]
    const result = importStaticHtml(files, 1)
    expect(result.pages).toBe(2)
    expect(result.stylesheets).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.project.config.pages?.[0].name).toBe('Home')
    expect(result.project.config.pages?.[0].blocks[0].props.body).toBe('Hello')
    expect(parseProjectFile(serializeProjectFile(result.project)).project.webstudioStaticSource).toEqual(files)
  })

  it('rejects a selection without HTML pages', () => {
    expect(() => importStaticHtml([{ path: 'site.css', text: 'body {}' }], 0)).toThrow('No HTML pages')
  })
})
