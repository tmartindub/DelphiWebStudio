import { test, expect } from 'vitest'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import JSZip from 'jszip'
import { exportSiteZip } from '../src/lib/export-html'
import type { SiteConfig } from '../src/blocks/types'

const browser = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
test.skipIf(process.env.WEBSTUDIO_OFFLINE_BROWSER_TEST !== '1' || !existsSync(browser))('renders a real exported nested page and PDF link offline', async () => {
  const pdf = await readFile('samples/Community_Bulletin_Sample.pdf')
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pdf))].map(x => x.toString(16).padStart(2, '0')).join('')
  const page = { id: 'news', name: 'News', path: '/community/news', blocks: [{ id: 'pdf', type: 'pdfViewer' as const, variant: 'default', props: { title: 'Bulletin', src: 'assets/example.pdf', showDownload: false } }] }
  const home = { id: 'home', name: 'Home', path: '/', blocks: [] }
  const site: SiteConfig = { name: 'Offline site', pages: [home, page], blocks: home.blocks }
  const archive = await JSZip.loadAsync(await (await exportSiteZip(site, undefined, [{ id: 'pdf', projectId: 'p', name: 'bulletin.pdf', path: 'assets/example.pdf', mime: 'application/pdf', size: pdf.length, sha256, content: new Blob([pdf], { type: 'application/pdf' }) }])).arrayBuffer())
  const root = resolve('test-results', `m6-offline-browser-${Date.now()}`)
  for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue
    const target = resolve(root, entry.name)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await entry.async('nodebuffer'))
  }
  const pageFile = resolve(root, 'community/news.html')
  const result = spawnSync(browser, ['--headless', '--disable-gpu', '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND', `--user-data-dir=${resolve(root, 'browser-profile')}`, '--dump-dom', pathToFileURL(pageFile).href], { encoding: 'utf8', timeout: 30000, windowsHide: true })
  expect(result.status, result.stderr).toBe(0)
  expect(result.stdout).toContain('<p data-webstudio-pdf-local-notice="">')
  expect(result.stdout).toContain('href="../assets/example.pdf">Open PDF locally</a>')
  expect(await readFile(resolve(root, 'assets/example.pdf'))).toEqual(pdf)
}, 45000)
