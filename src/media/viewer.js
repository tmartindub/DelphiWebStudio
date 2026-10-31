import { getDocument, GlobalWorkerOptions } from './pdf.min.js'

GlobalWorkerOptions.workerSrc = './pdf.worker.min.js'
const params = new URLSearchParams(location.search)
const file = params.get('file') || ''
const status = document.getElementById('status')
const canvas = document.getElementById('page-canvas')
const main = document.querySelector('main')
const pageInput = document.getElementById('page')
const zoomLabel = document.getElementById('zoom')
let pdf
let zoom = 1
let rendering
let renderSequence = 0

for (const [parameter, ids] of [['search', ['search-label', 'search']], ['download', ['download']], ['print', ['print']], ['fullscreen', ['fullscreen']]]) {
  if (params.get(parameter) === '0') for (const id of ids) document.getElementById(id).hidden = true
}

if (!/^\.\.\/[a-zA-Z0-9._-]+\.pdf$/i.test(file)) {
  status.textContent = 'Invalid PDF path.'
} else {
  document.getElementById('download').href = file
  document.getElementById('print').href = file
  const task = getDocument({ url: file, enableXfa: false })
  task.onPassword = update => {
    const password = window.prompt('Enter the PDF password:')
    if (password === null) { task.destroy(); status.textContent = 'Password required.' }
    else update(password)
  }
  task.promise.then(pdfDocument => {
    pdf = pdfDocument
    pageInput.max = String(pdf.numPages)
    const requestedPage = Number(params.get('page'))
    if (Number.isInteger(requestedPage) && requestedPage > 0) pageInput.value = String(Math.min(requestedPage, pdf.numPages))
    document.getElementById('total').textContent = `of ${pdf.numPages}`
    status.textContent = ''
    return render()
  }).catch(error => { status.textContent = `Unable to open PDF: ${error.message}` })
}

async function render() {
  if (!pdf) return
  const sequence = ++renderSequence
  if (rendering) { rendering.cancel(); try { await rendering.promise } catch { /* cancelled */ } }
  if (sequence !== renderSequence) return
  const number = Math.max(1, Math.min(pdf.numPages, Number(pageInput.value) || 1))
  pageInput.value = String(number)
  const page = await pdf.getPage(number)
  if (sequence !== renderSequence) return
  const style = getComputedStyle(main)
  const available = Math.max(1, main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
  const pageWidth = page.getViewport({ scale: 1 }).width
  const viewport = page.getViewport({ scale: Math.min(1, available / pageWidth) * zoom })
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  canvas.setAttribute('aria-label', `PDF page ${number} of ${pdf.numPages}`)
  rendering = page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport })
  try { await rendering.promise } catch (error) { if (error.name !== 'RenderingCancelledException') status.textContent = error.message }
}

document.getElementById('previous').onclick = () => { pageInput.value = String(Number(pageInput.value) - 1); void render() }
document.getElementById('next').onclick = () => { pageInput.value = String(Number(pageInput.value) + 1); void render() }
pageInput.onchange = () => void render()
document.getElementById('zoom-out').onclick = () => { zoom = Math.max(.5, zoom - .25); zoomLabel.textContent = `Fit ${Math.round(zoom * 100)}%`; void render() }
document.getElementById('zoom-in').onclick = () => { zoom = Math.min(3, zoom + .25); zoomLabel.textContent = `Fit ${Math.round(zoom * 100)}%`; void render() }
window.addEventListener('resize', () => { void render() })
document.getElementById('fullscreen').onclick = () => { void document.documentElement.requestFullscreen().catch(() => { status.textContent = 'Fullscreen unavailable.' }) }
document.getElementById('search').onclick = async () => {
  const query = document.getElementById('query').value.trim().toLocaleLowerCase()
  if (!pdf || !query) return
  status.textContent = 'Searching…'
  try {
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent()
      if (content.items.map(item => item.str || '').join(' ').toLocaleLowerCase().includes(query)) {
        pageInput.value = String(number)
        await render()
        status.textContent = `Found on page ${number}.`
        return
      }
    }
    status.textContent = 'No matching text found. Scanned documents may not contain searchable text.'
  } catch (error) { status.textContent = `Search failed: ${error.message}` }
}
