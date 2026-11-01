import http from 'node:http'
import { spawn } from 'node:child_process'

const key = 'a'.repeat(64)
let requests = 0
let failed = false
const server = http.createServer(async (request, response) => {
  let body = ''
  for await (const chunk of request) body += chunk
  try {
    const value = JSON.parse(body)
    const expectedSchema = requests < 2 ? 'site_plan' : requests < 4 ? 'site_colors' : 'site_page'
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions' || request.headers.authorization !== `Bearer ${key}` || value.response_format?.json_schema?.name !== expectedSchema || !value.messages?.[0]?.content?.includes('A community site')) throw new Error('Unexpected request')
    requests++
    const plan = requests <= 2
      ? { pages: Array.from({ length: requests === 1 ? 5 : 4 }, (_, index) => ({ name: `Page ${index + 1}`, headline: `Welcome ${index + 1}` })) }
      : requests <= 4 ? { bg0: requests === 3 ? '#ffffff' : '#zzzzzz', text0: '#000000', accent: '#007acc' }
        : { name: 'Contact', headline: requests === 5 ? 'Get in touch' : '' }
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }))
  } catch { failed = true; response.writeHead(400).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const executable = process.argv[2] || 'test-results/m4-ai-client-2034/LocalAIClientSmoke.exe'
  const child = spawn(executable, [String(server.address().port), key], { windowsHide: true })
  let output = ''
  child.stdout.on('data', value => { output += value })
  child.stderr.on('data', value => { output += value })
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve) })
  if (code !== 0 || failed || requests !== 6) throw new Error(`Native client check failed: exit ${code}, requests ${requests}, ${output}`)
  console.log(output.trim())
} finally { await new Promise(resolve => server.close(resolve)) }
