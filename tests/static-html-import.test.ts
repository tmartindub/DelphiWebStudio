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

  it('reconnects selected local pages and images without loading external content', () => {
    const files = [
      { path: 'site/index.html', text: '<body><p>Read <a href="about.html">About</a></p><img src="images/logo.svg" alt="Logo"><img src="https://outside.invalid/a.svg"></body>' },
      { path: 'site/about.html', text: '<body>About us</body>' },
    ]
    const result = importStaticHtml(files, 0, [{ sourcePath: 'site/images/logo.svg', assetId: 'image-id', assetPath: 'assets/image-id-logo.svg' }])
    const blocks = result.project.config.pages![0].blocks
    expect(blocks[0].props.body).toContain('[About](/imported-page-2)')
    expect(blocks[1]).toMatchObject({ type: 'image', props: { assetId: 'image-id', src: 'assets/image-id-logo.svg', alt: 'Logo' } })
    expect(blocks.filter(block => block.type === 'image')).toHaveLength(1)
    expect(result.issueCount).toBe(1)
    expect(result.issues[0]).toMatchObject({ source: 'site/index.html', reference: 'https://outside.invalid/a.svg', reason: 'Image was not placed' })
  })

  it('reports missing links and omitted fragments before conversion', () => {
    const result = importStaticHtml([
      { path: 'site/index.html', text: '<body><a href="missing.html">Missing</a><a href="about.html#team">Team</a><img src="missing.png"></body>' },
      { path: 'site/about.html', text: '<body>About</body>' },
    ], 0)
    expect(result.issueCount).toBe(3)
    expect(result.issues.map(issue => issue.reason)).toEqual(['Link was not converted', 'Link query or fragment was omitted', 'Image was not placed'])
    expect(result.project.config.pages![0].blocks[0].props.body).toContain('[Team](/imported-page-2)')
  })

  it('converts basic headings, lists and emphasis into editable content', () => {
    const result = importStaticHtml([{ path: 'site/index.html', text: '<body><h2>Welcome</h2><ul><li><strong>One</strong></li><li><em>Two</em></li></ul></body>' }], 0)
    expect(result.project.config.pages![0].blocks[0].props.body).toContain('## Welcome')
    expect(result.project.config.pages![0].blocks[0].props.body).toContain('- **One**')
    expect(result.project.config.pages![0].blocks[0].props.body).toContain('- *Two*')
  })
})
