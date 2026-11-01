import { createHash, randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import net from 'node:net'
import JSZip from '../../node_modules/jszip/lib/index.js'

const base = process.argv[2]
if (!base) throw new Error('Supply the directory containing the verified runtime and model.')
const runtime = join(base, 'runtime')
const model = process.argv[3] || join(base, 'Qwen3-1.7B-Q8_0.gguf')
const modelSHA256 = process.argv[4] || '061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a'
const hashFile = path => new Promise((resolve, reject) => {
  const hash = createHash('sha256'); const stream = createReadStream(path)
  stream.on('data', chunk => hash.update(chunk)); stream.on('end', () => resolve(hash.digest('hex'))); stream.on('error', reject)
})
if (await hashFile(model) !== modelSHA256.toLowerCase()) throw new Error('Model checksum mismatch')
const archivePath = join(base, 'llama-b12012-win-cpu-x64.zip')
if (await hashFile(archivePath) !== '7605ee19d22ff58053d0df045f972367f6e6fd36bbcd02e7c0633ca639603a85') throw new Error('Runtime checksum mismatch')
const archive = await JSZip.loadAsync(await readFile(archivePath))
const names = Object.keys(archive.files).filter(name => name === 'llama-server.exe' || name.toLowerCase().endsWith('.dll'))
for (const name of await readdir(runtime)) if (name.toLowerCase().endsWith('.dll') && !names.includes(name)) throw new Error('Unexpected runtime DLL')
for (const name of names) {
  const expected = createHash('sha256').update(await archive.file(name).async('nodebuffer')).digest('hex')
  if (await hashFile(join(runtime, name)) !== expected) throw new Error(`Runtime file mismatch: ${name}`)
}
const dir = await mkdtemp(join(process.cwd(), 'test-results', 'm4-quality-'))
const key = randomBytes(32).toString('hex')
const keyPath = join(dir, 'key.txt')
await writeFile(keyPath, key, { flag: 'wx' })
const probe = net.createServer()
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
const port = probe.address().port
await new Promise(resolve => probe.close(resolve))
const server = spawn(join(runtime, 'llama-server.exe'), ['--model', model, '--api-key-file', keyPath, '--host', '127.0.0.1', '--port', String(port), '--offline', '--no-webui', '--no-slots', '--parallel', '1'], { windowsHide: true, cwd: runtime, stdio: 'ignore' })
try {
  let ready = false
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error('Model process exited during startup')
    try { if ((await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  if (!ready) throw new Error('Model startup timed out')
  const briefs = [
    'A church community site with events and a library of PDF bulletins.',
    'A photographer portfolio showing landscapes and exhibitions.',
    'A local bakery information site describing products and opening hours; no online ordering.'
  ]
  for (const brief of briefs) {
    const child = spawn('test-results/m4-ai-client-2034/LocalAIClientRealSmoke.exe', [String(port), key, brief], { windowsHide: true })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', value => { stdout += value }); child.stderr.on('data', value => { stderr += value })
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve) })
    if (code !== 0) throw new Error(`Native local AI client failed: ${stderr || stdout}`)
    const plan = JSON.parse(stdout)
    const pageNames = plan.pages.map(page => page.name.trim().toLowerCase())
    if (pageNames.length !== 5 || new Set(pageNames).size !== 5) throw new Error(`Invalid page names for ${brief}`)
    console.log(JSON.stringify({ brief, pages: plan.pages }))
  }
} finally {
  if (server.exitCode === null) server.kill()
  await new Promise(resolve => { if (server.exitCode !== null) return resolve(); server.once('exit', resolve); setTimeout(resolve, 5000) })
  await rm(keyPath, { force: true }); await rmdir(dir)
}

