import { createElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { useConfigStore } from '@/store/configStore'
import { markdownBlockClasses, markdownListClass, renderMarkdown } from '@/lib/markdown'
import { chooseWindowsFont } from '@/desktop/native-bridge'
import { WindowsColorInput } from '@/editor/WindowsColorInput'
import { resolveTheme } from '@/lib/theme-presets'

type MarkdownTag = keyof typeof markdownBlockClasses
type SpellingHost = { webstudioNativeSpellingMenu?: boolean; chrome?: { webview?: { postMessage(message: unknown): void; addEventListener(type: 'message', listener: (event: MessageEvent) => void): void; removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void } } }
type Run = { text: string; font?: string; size?: number; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string; align?: 'left' | 'center' | 'right' | 'justify'; tag?: MarkdownTag; line?: number; lineHeight?: number; spaceBefore?: number; spaceAfter?: number; indentLeft?: number; indentRight?: number; firstLineIndent?: number }
type Props = { blockId: string; field: string; text: string; value: unknown; editable?: boolean; multiline?: boolean; markdown?: boolean; position?: { x: number; y: number; width?: number; height?: number }; fill?: boolean; alignment?: unknown; onDeleteBox?: () => void }
let draggedText: { element: HTMLElement; range: Range } | null = null

export function RichText({ blockId, field, text, value, editable = false, multiline = false, markdown = false, position, fill = false, alignment, onDeleteBox }: Props) {
  const root = useRef<HTMLElement>(null)
  const dirty = useRef(false)
  const savedRange = useRef<Range | null>(null)
  const menuActive = useRef(false)
  const nativeMenuRequest = useRef<string | null>(null)
  const nativeMenuPoint = useRef<{ x: number; y: number } | null>(null)
  const menuElement = useRef<HTMLDivElement>(null)
  const menuDrag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const menuMoved = useRef(false)
  const moveRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; width: number; height: number; maxWidth: number; direction: string } | null>(null)
  const [resizeSize, setResizeSize] = useState<{ width: number; height: number } | null>(null)
  const [guides, setGuides] = useState<{ vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } }>({})
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [menuView, setMenuView] = useState<'context' | 'text' | 'paragraph'>('context')
  const pastePlain = useRef(false)
  const [paragraph, setParagraph] = useState({ align: 'left', lineHeight: 1.5, spaceBefore: 0, spaceAfter: 0, indentLeft: 0, indentRight: 0, firstLineIndent: 0 })
  const [clipboardError, setClipboardError] = useState('')
  const [linkEditor, setLinkEditor] = useState<{ address: string; hasLink: boolean; error?: string } | null>(null)
  const linkOpen = linkEditor !== null
  const runs = Array.isArray(value) ? value.filter((item): item is Run => !!item && typeof item === 'object' && typeof item.text === 'string') : null

  useEffect(() => {
    const webview = (window as unknown as SpellingHost).chrome?.webview
    if (!editable || !webview) return
    const receive = (event: MessageEvent) => {
      const reply = event.data
      if (!nativeMenuRequest.current || !reply || reply.version !== 1 || reply.kind !== 'ui.text.context' || reply.requestId !== nativeMenuRequest.current || typeof reply.native !== 'boolean') return
      nativeMenuRequest.current = null
      if (!menuActive.current) return
      if (reply.native) {
        // Do not save or rebuild the editable DOM while WebView2 owns the spelling range.
        menuActive.current = false; savedRange.current = null; setMenu(null); setLinkEditor(null)
      } else if (nativeMenuPoint.current) openTextSettings(nativeMenuPoint.current.x, nativeMenuPoint.current.y, null, false, 'context')
      nativeMenuPoint.current = null
    }
    webview.addEventListener('message', receive)
    return () => webview.removeEventListener('message', receive)
  }, [editable]) // eslint-disable-line react-hooks/exhaustive-deps

  function save() {
    const element = root.current
    if (!element || !editable || !dirty.current) return
    const output: Run[] = []
    let line = 0
    const collect = (node: Node, style: Omit<Run, 'text'>) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) output.push({ text: node.textContent, ...style })
        return
      }
      if (!(node instanceof HTMLElement)) return
      if (node.tagName === 'BR') { output.push({ text: '\n', ...style }); return }
      const next = { ...style }
      const markdownTag = node !== element && (markdown || multiline) && (Object.hasOwn(markdownBlockClasses, node.localName) || node.tagName === 'DIV')
      if (markdownTag) {
        next.tag = node.tagName === 'DIV' ? 'p' : node.localName as MarkdownTag
        next.line = ++line
      } else if (node.tagName === 'LI') {
        if (output.length && !output[output.length - 1].text.endsWith('\n')) output.push({ text: '\n' })
        if (!node.textContent?.trimStart().startsWith('• ')) output.push({ text: '• ', ...style })
      }
      if (node.style.textAlign === 'left' || node.style.textAlign === 'center' || node.style.textAlign === 'right' || node.style.textAlign === 'justify') next.align = node.style.textAlign
      for (const [key, property, minimum, maximum] of [['lineHeight', 'lineHeight', 1, 3], ['spaceBefore', 'marginTop', 0, 200], ['spaceAfter', 'marginBottom', 0, 200], ['indentLeft', 'marginLeft', 0, 400], ['indentRight', 'marginRight', 0, 400], ['firstLineIndent', 'textIndent', -200, 400]] as const) {
        const raw = node.style[property], number = Number.parseFloat(raw)
        if (raw && Number.isFinite(number) && number >= minimum && number <= maximum && (key === 'lineHeight' ? /^[\d.]+$/.test(raw) : raw.endsWith('px'))) next[key] = number
      }
      const font = node.style.fontFamily.replace(/["']/g, '').trim()
      if (font && /^[\p{L}\p{N} ,._-]{1,100}$/u.test(font)) next.font = font
      const size = Number.parseFloat(node.style.fontSize)
      if (Number.isFinite(size) && size >= 6 && size <= 200 && node.style.fontSize.endsWith('px')) next.size = size
      const color = node.style.color
      if (/^#[0-9a-f]{6}$/i.test(color) || /^rgba?\(\s*[\d.,%\s]+\)$/i.test(color)) next.color = color
      if (node.tagName === 'B' || node.tagName === 'STRONG' || node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600) next.bold = true
      else if (node.style.fontWeight === 'normal' || (node.style.fontWeight && Number(node.style.fontWeight) > 0 && Number(node.style.fontWeight) < 600)) next.bold = false
      if (node.tagName === 'I' || node.tagName === 'EM' || node.style.fontStyle === 'italic') next.italic = true
      else if (node.style.fontStyle === 'normal') next.italic = false
      if (node.tagName === 'U' || node.style.textDecorationLine.includes('underline')) next.underline = true
      else if (node.style.textDecorationLine === 'none') next.underline = false
      const href = node.tagName === 'A' ? node.getAttribute('href') : null
      if (href && !/[\\\p{Cc}]/u.test(href) && !href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(href) || /^(https?:|mailto:|tel:)/i.test(href))) {
        next.href = href
        next.underline ??= true
      }
      if (!markdownTag && (node.tagName === 'P' || node.tagName === 'DIV') && output.length && !output[output.length - 1].text.endsWith('\n')) output.push({ text: '\n' })
      node.childNodes.forEach(child => collect(child, next))
    }
    collect(element, {})
    const plain = output.map((item, index) => {
      const previous = output[index - 1]
      if (!previous || previous.line === item.line || previous.text.endsWith('\n')) return item.text
      return '\n' + item.text
    }).join('')
    const current = useConfigStore.getState().getActivePageBlocks().find(block => block.id === blockId)
    dirty.current = false
    if (!current) return
    const object = element.closest<HTMLElement>('[data-section-object][data-ws-object-type="text"]')
    const section = object?.closest<HTMLElement>('[data-editor-section]')
    const key = section ? `section${section.dataset.editorSection}Objects` : ''
    const items = key && Array.isArray(current.props[key]) ? current.props[key] as { id: string; height: number }[] : []
    const measuredHeight = object ? Math.ceil(Math.max(object.scrollHeight, element.scrollHeight)) : 0
    const needsHeight = items.some(item => item.id === object?.dataset.sectionObject && measuredHeight > (Number(item.height) || 80))
    if (!needsHeight && current.props[field] === plain && JSON.stringify(current.props[`${field}Rich`]) === JSON.stringify(output)) return
    useConfigStore.getState().updateBlockProps(blockId, { [field]: plain, [`${field}Rich`]: output, ...(needsHeight ? { [key]: items.map(item => item.id === object?.dataset.sectionObject ? { ...item, height: measuredHeight } : item) } : {}) })
  }

  useEffect(() => {
    const element = root.current
    element?.addEventListener('webstudio-flush-text', save)
    return () => element?.removeEventListener('webstudio-flush-text', save)
  })

  function apply(style: Partial<CSSStyleDeclaration>) {
    const range = savedRange.current
    if (!range || range.collapsed || !root.current?.contains(range.commonAncestorContainer)) return
    const span = document.createElement('span')
    Object.assign(span.style, style)
    span.setAttribute('data-rich-run', '')
    const fragment = range.extractContents()
    if (!style.textAlign) fragment.querySelectorAll<HTMLElement>('*').forEach(element => Object.assign(element.style, style))
    span.appendChild(fragment)
    range.insertNode(span)
    dirty.current = true
    const next = document.createRange()
    next.selectNodeContents(span)
    savedRange.current = next
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(next)
  }

  function insertPastedHtml(html: string, plain: string, mode: 'match' | 'source' | 'plain' = 'source') {
    if (mode === 'plain' || !html) { if (plain) document.execCommand('insertText', false, plain); return }
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const container = document.createElement('div')
    const copy = (node: Node, parent: Node) => {
      if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent || '')); return }
      if (!(node instanceof HTMLElement)) return
      const tag = node.tagName.toLowerCase()
      if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'img'].includes(tag)) return
      const allowed = ['p', 'div', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'].includes(tag)
      if (!allowed) { node.childNodes.forEach(child => copy(child, parent)); return }
      const clean = document.createElement(mode === 'match' && /^h[1-6]$/.test(tag) ? 'p' : tag)
      if (mode === 'source') {
      const font = node.style.fontFamily.replace(/["']/g, '').trim()
      if (font && /^[\p{L}\p{N} ,._-]{1,100}$/u.test(font)) clean.style.fontFamily = font
      const size = Number.parseFloat(node.style.fontSize)
      if (Number.isFinite(size) && size >= 6 && size <= 200 && node.style.fontSize.endsWith('px')) clean.style.fontSize = `${size}px`
      if (/^#[0-9a-f]{6}$/i.test(node.style.color) || /^rgba?\(\s*[\d.,%\s]+\)$/i.test(node.style.color)) clean.style.color = node.style.color
      if (node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600) clean.style.fontWeight = 'bold'
      else if (node.style.fontWeight === 'normal' || (node.style.fontWeight && Number(node.style.fontWeight) > 0 && Number(node.style.fontWeight) < 600)) clean.style.fontWeight = 'normal'
      if (node.style.fontStyle === 'italic') clean.style.fontStyle = 'italic'
      else if (node.style.fontStyle === 'normal') clean.style.fontStyle = 'normal'
      if (['left', 'center', 'right', 'justify'].includes(node.style.textAlign)) clean.style.textAlign = node.style.textAlign
      for (const [property, minimum, maximum] of [['lineHeight', 1, 3], ['marginTop', 0, 200], ['marginBottom', 0, 200], ['marginLeft', 0, 400], ['marginRight', 0, 400], ['textIndent', -200, 400]] as const) {
        const raw = node.style[property], number = Number.parseFloat(raw)
        if (raw && Number.isFinite(number) && number >= minimum && number <= maximum && (property === 'lineHeight' ? /^[\d.]+$/.test(raw) : raw.endsWith('px'))) clean.style[property] = raw
      }
      if (node.style.textDecorationLine.includes('underline')) clean.style.textDecoration = 'underline'
      else if (node.style.textDecorationLine === 'none') clean.style.textDecoration = 'none'
      }
      const href = tag === 'a' ? node.getAttribute('href') : null
      if (href && !/[\\\p{Cc}]/u.test(href) && !href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(href) || /^(https?:|mailto:|tel:)/i.test(href))) clean.setAttribute('href', href)
      node.childNodes.forEach(child => copy(child, clean))
      parent.appendChild(clean)
    }
    parsed.body.childNodes.forEach(node => copy(node, container))
    if (mode === 'match') {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) node.textContent = (node.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ')
    }
    if (container.textContent || container.querySelector('br')) document.execCommand('insertHTML', false, container.innerHTML)
    else if (plain) document.execCommand('insertText', false, plain)
  }


  function selectedParagraphs() {
    const element = root.current, range = savedRange.current
    if (!element || !range || !element.contains(range.commonAncestorContainer)) return []
    const selection = window.getSelection()
    element.focus({ preventScroll: true }); selection?.removeAllRanges(); selection?.addRange(range)
    const selector = 'p,h1,h2,h3,h4,h5,h6,li,div'
    let nodes = Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(node => range.intersectsNode(node))
    if (!nodes.length && multiline) {
      document.execCommand('formatBlock', false, 'p')
      const updated = selection?.rangeCount ? selection.getRangeAt(0) : range
      savedRange.current = updated.cloneRange()
      nodes = Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(node => updated.intersectsNode(node))
    }
    if (!nodes.length) {
      const paragraph = document.createElement(multiline ? 'p' : 'span')
      paragraph.append(...element.childNodes); element.appendChild(paragraph); nodes = [paragraph]
    }
    return nodes.filter(node => !nodes.some(child => child !== node && node.contains(child)))
  }

  function openParagraphSettings() {
    const node = savedRange.current?.startContainer
    const element = node instanceof Element ? node : node?.parentElement
    const block = element?.closest('p,h1,h2,h3,h4,h5,h6,li,div') ?? root.current
    if (block) {
      const style = getComputedStyle(block)
      setParagraph({ align: ['left', 'center', 'right', 'justify'].includes(style.textAlign) ? style.textAlign : 'left', lineHeight: Math.max(1, Math.min(3, parseFloat(style.lineHeight) / parseFloat(style.fontSize) || 1.5)), spaceBefore: Math.max(0, parseFloat(style.marginTop) || 0), spaceAfter: Math.max(0, parseFloat(style.marginBottom) || 0), indentLeft: Math.max(0, parseFloat(style.marginLeft) || 0), indentRight: Math.max(0, parseFloat(style.marginRight) || 0), firstLineIndent: parseFloat(style.textIndent) || 0 })
    }
    menuMoved.current = false
    setMenuView('paragraph')
  }

  function applyParagraph(style: Partial<CSSStyleDeclaration>) {
    const nodes = selectedParagraphs()
    for (const node of nodes) {
      Object.assign(node.style, style)
      node.querySelectorAll<HTMLElement>('*').forEach(child => {
        for (const key of Object.keys(style)) child.style.removeProperty(key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()))
      })
    }
    if (nodes.length) dirty.current = true
  }

  function resetNormal() {
    const nodes = selectedParagraphs(), theme = resolveTheme(useConfigStore.getState().config.theme)
    for (let node of nodes) {
      if (multiline && node !== root.current && !['P', 'LI'].includes(node.tagName)) {
        const replacement = document.createElement('p')
        replacement.append(...node.childNodes); node.replaceWith(replacement); node = replacement
      }
      node.removeAttribute('style'); node.removeAttribute('class')
      node.querySelectorAll<HTMLElement>('*').forEach(child => {
        child.removeAttribute('style'); child.removeAttribute('class')
        if (child.tagName === 'A') child.style.textDecoration = 'underline'
        else if (child.tagName !== 'BR') child.replaceWith(...child.childNodes)
      })
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      let textNode: Node | null, trailingSpace = false
      while ((textNode = walker.nextNode())) {
        let content = (textNode.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ')
        if (trailingSpace) content = content.replace(/^ /, '')
        trailingSpace = content.endsWith(' '); textNode.textContent = content
      }
      Object.assign(node.style, { fontFamily: theme.fontSans, fontSize: '16px', color: useConfigStore.getState().config.theme?.text0 || '#000000', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', lineHeight: '1.5', margin: '0px', textIndent: '0px' })
    }
    if (nodes.length) dirty.current = true
    close()
  }

  async function pasteFromClipboard(mode: 'match' | 'source' | 'plain') {
    try {
      const entries = await navigator.clipboard.read(), entry = entries[0]
      if (!entry || !root.current) throw new Error('Clipboard is empty')
      const html = entry.types.includes('text/html') ? await (await entry.getType('text/html')).text() : ''
      const plain = entry.types.includes('text/plain') ? await (await entry.getType('text/plain')).text() : ''
      root.current.focus({ preventScroll: true }); const selection = window.getSelection()
      if (savedRange.current && root.current.contains(savedRange.current.commonAncestorContainer)) { selection?.removeAllRanges(); selection?.addRange(savedRange.current) }
      insertPastedHtml(html, plain, mode); dirty.current = true; close()
    } catch { setClipboardError('Clipboard access is unavailable. Click in the text and press Ctrl+V, or Ctrl+Shift+V for plain text.') }
  }

  function close() {
    nativeMenuRequest.current = null
    nativeMenuPoint.current = null
    menuActive.current = false
    savedRange.current = null
    setMenu(null)
    setLinkEditor(null)
    save()
  }

  function showLinkEditor() {
    let range = savedRange.current
    if (!range || !root.current?.contains(range.commonAncestorContainer)) return
    if (range.collapsed) {
      const node = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
      const link = node?.closest('a[href]')
      if (!link || !root.current.contains(link)) return
      range = document.createRange(); range.selectNodeContents(link); savedRange.current = range.cloneRange()
    }
    const links = Array.from(root.current.querySelectorAll('a[href]')).filter(link => range.intersectsNode(link))
    const firstAddress = links[0]?.getAttribute('href') ?? ''
    const address = links.every(link => link.getAttribute('href') === firstAddress) ? firstAddress : ''
    setLinkEditor({ address, hasLink: links.length > 0 })
  }

  function openTextSettings(clientX: number, clientY: number, link?: Element | null, linkOnly = false, view: 'context' | 'text' = 'text') {
    const element = root.current
    if (!element) return
    const selection = window.getSelection()
    let range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!range || (range.collapsed && view !== 'context') || !element.contains(range.commonAncestorContainer)) {
      const clickedLink = link?.closest('a[href]')
      if (linkOnly && !clickedLink) return
      range = document.createRange()
      range.selectNodeContents(clickedLink && element.contains(clickedLink) ? clickedLink : element)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
    savedRange.current = range.cloneRange()
    setMenuView(view)
    menuActive.current = true
    setClipboardError('')
    menuMoved.current = false
    setMenu({ x: Math.max(0, Math.min(clientX, window.innerWidth - 320)), y: Math.max(0, Math.min(clientY, window.innerHeight - 200)) })
    if (linkOnly) showLinkEditor()
    else setLinkEditor(null)
  }

  function updateLink(remove = false) {
    if (!linkEditor) return
    const address = linkEditor.address.trim()
    if (!remove && (/[\s\\\p{Cc}]/u.test(address) || !/^(?:https?:\/\/[^/?#]+|\/(?!\/)|#[^#]|mailto:[^?]+|tel:[^?]+)/i.test(address))) {
      setLinkEditor({ ...linkEditor, error: 'Choose a page or enter a valid website address, page path, #anchor, email, or phone link.' })
      return
    }
    const element = root.current
    const range = savedRange.current
    if (!element || !range || range.collapsed || !element.contains(range.commonAncestorContainer)) {
      setLinkEditor({ ...linkEditor, error: 'Select the text again before applying a link.' })
      return
    }
    element.focus({ preventScroll: true })
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    if (!document.execCommand(remove ? 'unlink' : 'createLink', false, address)) {
      setLinkEditor({ ...linkEditor, error: 'The link could not be changed. Select the text and try again.' })
      return
    }
    dirty.current = true
    close()
  }
  useLayoutEffect(() => {
    const element = menuElement.current
    if (!menu || !element) return
    const place = () => {
      const gap = 12, viewport = window.visualViewport
      const viewportWidth = viewport?.width ?? window.innerWidth, viewportHeight = viewport?.height ?? window.innerHeight
      element.style.maxHeight = `${Math.max(80, viewportHeight - gap * 2)}px`
      element.style.overflowY = 'auto'
      const bounds = element.getBoundingClientRect()
      const target = (root.current?.closest('[data-section-object]') ?? root.current)?.getBoundingClientRect()
      const x = menuMoved.current ? bounds.left : menuView === 'context' ? menu.x : target && target.right + gap + bounds.width <= viewportWidth ? target.right + gap : target && target.left - gap >= bounds.width ? target.left - gap - bounds.width : menu.x
      const y = menuMoved.current ? bounds.top : menuView === 'context' ? Math.min(menu.y, (viewportHeight - bounds.height) / 2) : Math.min(target?.top ?? menu.y, 80)
      element.style.left = `${Math.max(gap, Math.min(x, viewportWidth - bounds.width - gap))}px`
      element.style.top = `${Math.max(gap, Math.min(y, viewportHeight - bounds.height - gap))}px`
    }
    place()
    if (menuView === 'context' && !nativeMenuRequest.current && !element.contains(document.activeElement)) element.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true })
    const observer = new ResizeObserver(place); observer.observe(element)
    window.addEventListener('resize', place); window.visualViewport?.addEventListener('resize', place)
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place) }
  }, [menu, linkOpen, menuView])
  useEffect(() => {
    if (!menu) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const outside = (event: globalThis.PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('[data-rich-menu]')) close() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', outside) }
  }, [menu]) // eslint-disable-line react-hooks/exhaustive-deps

  const formattedRuns = runs?.map((run, index) => createElement(typeof run.href === 'string' && !!run.href && !/[\\\p{Cc}]/u.test(run.href) && !run.href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(run.href) || /^(https?:|mailto:|tel:)/i.test(run.href)) ? 'a' : 'span', {
    key: index, 'data-rich-run': '', style: {
      ...(typeof run.font === 'string' && /^[\p{L}\p{N} ,._-]{1,100}$/u.test(run.font) ? { fontFamily: run.font } : {}),
      ...(typeof run.size === 'number' && Number.isFinite(run.size) && run.size >= 6 && run.size <= 200 ? { fontSize: `${run.size}px` } : {}),
      ...(typeof run.color === 'string' && (/^#[0-9a-f]{6}$/i.test(run.color) || /^rgba?\(\s*[\d.,%\s]+\)$/i.test(run.color)) ? { color: run.color } : {}),
      ...(typeof run.bold === 'boolean' ? { fontWeight: run.bold ? 'bold' : 'normal' } : {}), ...(typeof run.italic === 'boolean' ? { fontStyle: run.italic ? 'italic' : 'normal' } : {}), ...(typeof run.underline === 'boolean' ? { textDecoration: run.underline ? 'underline' : 'none' } : {}),
    }, ...(typeof run.href === 'string' && !!run.href && !/[\\\p{Cc}]/u.test(run.href) && !run.href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(run.href) || /^(https?:|mailto:|tel:)/i.test(run.href)) ? { href: run.href } : {}),
  }, run.text))
  const groups = runs?.reduce<{ align?: Run['align']; tag?: MarkdownTag; line?: number; paragraph: Run; children: ReactNode[] }[]>((result, run, index) => {
    const align = run.align === 'left' || run.align === 'center' || run.align === 'right' || run.align === 'justify' ? run.align : undefined
    const tag = (markdown || multiline) && run.tag && Object.hasOwn(markdownBlockClasses, run.tag) ? run.tag : undefined
    const last = result[result.length - 1]
    if (last && last.align === align && last.tag === tag && last.line === run.line && ['lineHeight', 'spaceBefore', 'spaceAfter', 'indentLeft', 'indentRight', 'firstLineIndent'].every(key => last.paragraph[key as keyof Run] === run[key as keyof Run])) last.children.push(formattedRuns![index])
    else result.push({ align, tag, line: run.line, paragraph: run, children: [formattedRuns![index]] })
    return result
  }, [])
  const lines = groups?.reduce<{ list: boolean; children: ReactNode[] }[]>((result, group, index) => {
    const element = createElement(group.tag ?? 'span', {
      key: index,
      className: markdown && group.tag ? markdownBlockClasses[group.tag] : undefined,
      style: { ...(group.align ? { display: group.tag === 'li' ? undefined : 'block', textAlign: group.align } : {}), ...Object.fromEntries(([['lineHeight', 'lineHeight', 1, 3], ['spaceBefore', 'marginTop', 0, 200], ['spaceAfter', 'marginBottom', 0, 200], ['indentLeft', 'marginLeft', 0, 400], ['indentRight', 'marginRight', 0, 400], ['firstLineIndent', 'textIndent', -200, 400]] as const).flatMap(([key, property, minimum, maximum]) => { const value = group.paragraph[key]; return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? [[property, key === 'lineHeight' ? value : `${value}px`], ['display', group.tag === 'li' ? 'list-item' : 'block']] : [] })) },
    }, group.children)
    const last = result[result.length - 1]
    if (group.tag === 'li' && last?.list) last.children.push(element)
    else result.push({ list: group.tag === 'li', children: [element] })
    return result
  }, [])
  const content: ReactNode = lines ? lines.map((line, index) => line.list ? createElement('ul', { key: index, className: markdownListClass }, line.children) : line.children[0]) : markdown ? renderMarkdown(text) : text
  // React escapes text and renders only the supported formatting above; never store or render pasted HTML directly.
  const markup = renderToStaticMarkup(createElement('div', null, content)).slice(5, -6)
  useLayoutEffect(() => {
    if (editable && root.current && !dirty.current && root.current.innerHTML !== markup) root.current.innerHTML = markup
  }, [editable, markup])

  const Tag = multiline ? 'div' : 'span'
  const Outer = multiline ? 'div' : 'span'
  const textAlign = alignment === 'left' || alignment === 'center' || alignment === 'right' || alignment === 'justify' ? alignment : undefined
  const x = Number.isFinite(position?.x) ? Math.max(-2000, Math.min(2000, position!.x)) : 0
  const y = Number.isFinite(position?.y) ? Math.max(-2000, Math.min(2000, position!.y)) : 0
  const colorNode = menu ? savedRange.current?.startContainer : null
  const selectedNode = colorNode && colorNode instanceof Element ? colorNode.childNodes.item(savedRange.current?.startOffset ?? 0) ?? colorNode : colorNode
  let colorElement = selectedNode ? (selectedNode instanceof Element ? selectedNode : selectedNode.parentElement) : null
  while (colorElement?.firstElementChild) colorElement = colorElement.firstElementChild
  const selectedStyle = colorElement ? getComputedStyle(colorElement) : null
  const colorParts = selectedStyle?.color.match(/\d+/g)?.slice(0, 3) ?? null
  const selectedColor = colorParts?.length === 3 ? `#${colorParts.map(value => Math.min(255, Number(value)).toString(16).padStart(2, '0')).join('')}` : '#000000'
  const selectedFont = selectedStyle?.fontFamily.split(',')[0].replace(/["']/g, '').trim() || ''
  const selectedSize = Math.max(6, Math.min(200, Math.round(parseFloat(selectedStyle?.fontSize || '') || 16)))
  const updatePosition = (nextX: number, nextY: number) => useConfigStore.getState().updateBlockProps(blockId, { [`${field}OffsetX`]: Math.round(Math.max(-2000, Math.min(2000, nextX))), [`${field}OffsetY`]: Math.round(Math.max(-2000, Math.min(2000, nextY))) })
  return <>
    <Outer data-text-position={position ? field : undefined} className={position && editable ? 'group/text relative inline-block' : undefined} style={position ? { display: 'inline-block', position: 'relative', maxWidth: '100%', overflowWrap: 'anywhere', transform: `translate(${x}px, ${y}px)`, ...(position.width && position.width > 0 ? { width: `${position.width}px` } : {}), ...(position.height && position.height > 0 ? { minHeight: `${position.height}px` } : {}), ...(textAlign ? { textAlign } : {}) } : { ...(fill && editable ? { display: 'flex', flex: '1 1 auto' } : {}), ...(textAlign ? { display: fill && editable ? 'flex' : 'block', width: '100%', textAlign } : {}) }}>
    <Tag ref={(element: HTMLElement | null) => { root.current = element }} data-rich-text data-rich-editor={editable ? field : undefined} role={editable ? 'textbox' : undefined} aria-label={editable ? `Edit ${field}` : undefined} aria-multiline={editable && multiline ? true : undefined} contentEditable={editable || undefined} spellCheck={editable || undefined} suppressContentEditableWarning style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...(editable ? { display: 'inline-block', minWidth: '2em', minHeight: '1em', cursor: 'text' } : {}), ...(editable && multiline ? { display: 'block', minHeight: '3em', ...(fill ? { flex: 1 } : {}) } : {}) }}
      onBlur={() => { if (!menuActive.current && !draggedText) save() }}
      onInput={() => { dirty.current = true; requestAnimationFrame(() => { const element = root.current; const section = element?.closest<HTMLElement>('[data-editor-section]'); if (!element || !section) return; const object = element.closest<HTMLElement>('[data-section-object][data-ws-object-type="text"]'); if (object) { const bottom = object.offsetTop + Math.max(object.scrollHeight, element.scrollHeight); section.style.minHeight = `${Math.max(section.offsetHeight, bottom)}px` }; if (position) { const bounds = element.getBoundingClientRect(), area = section.getBoundingClientRect(); const correction = bounds.left < area.left ? area.left - bounds.left : bounds.right > area.right ? area.right - bounds.right : 0; if (Math.abs(correction) > 1) updatePosition(x + correction, y) } }) }}
      onCopy={event => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !root.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return
        const node = selection.getRangeAt(0).startContainer
        const style = getComputedStyle(node instanceof Element ? node : node.parentElement || root.current)
        const span = document.createElement('span')
        span.style.fontFamily = style.fontFamily; span.style.fontSize = style.fontSize; span.style.color = style.color
        span.style.fontWeight = style.fontWeight; span.style.fontStyle = style.fontStyle
        span.appendChild(selection.getRangeAt(0).cloneContents())
        event.clipboardData.setData('text/plain', selection.toString())
        event.clipboardData.setData('text/html', span.outerHTML)
        event.preventDefault()
      }}
      onPaste={event => {
        const html = event.clipboardData.getData('text/html')
        const plain = event.clipboardData.getData('text/plain')
        if (!html && !plain) return
        event.preventDefault()
        insertPastedHtml(html, plain, pastePlain.current ? 'plain' : 'match')
        pastePlain.current = false
        dirty.current = true
      }}
      onKeyDown={event => {
        event.stopPropagation()
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') pastePlain.current = event.shiftKey
        if (editable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault()
          const bounds = event.currentTarget.getBoundingClientRect()
          const node = window.getSelection()?.anchorNode
          openTextSettings(bounds.right, bounds.top, node instanceof Element ? node : node?.parentElement, true)
        } else if (!multiline && event.key === 'Enter') {
          event.preventDefault()
          root.current?.blur()
        }
      }}
      onContextMenu={event => {
        if (!editable) return
        event.stopPropagation()
        const host = window as unknown as SpellingHost
        nativeMenuRequest.current = null
        if (event.isTrusted && window.location.origin === 'https://webstudio.local' && host.webstudioNativeSpellingMenu && host.chrome?.webview) {
          const requestId = crypto.randomUUID()
          nativeMenuRequest.current = requestId
          nativeMenuPoint.current = { x: event.clientX, y: event.clientY }
          menuActive.current = true
          try { host.chrome.webview.postMessage({ version: 1, kind: 'ui.text.context', requestId }); return }
          catch { nativeMenuRequest.current = null; nativeMenuPoint.current = null; event.preventDefault() }
        } else event.preventDefault()
        openTextSettings(event.clientX, event.clientY, event.target instanceof Element ? event.target : null, false, 'context')
      }}
      onDragStart={event => {
        if (!editable) return
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !root.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return
        const node = selection.getRangeAt(0).startContainer
        const style = getComputedStyle(node instanceof Element ? node : node.parentElement || root.current)
        const span = document.createElement('span')
        span.style.fontFamily = style.fontFamily
        span.style.fontSize = style.fontSize
        span.style.color = style.color
        span.style.fontWeight = style.fontWeight
        span.style.fontStyle = style.fontStyle
        span.appendChild(selection.getRangeAt(0).cloneContents())
        root.current.dataset.richDragging = 'true'
        draggedText = { element: root.current, range: selection.getRangeAt(0).cloneRange() }
        event.dataTransfer.setData('text/plain', selection.toString())
        event.dataTransfer.setData('text/html', span.outerHTML)
        event.dataTransfer.effectAllowed = 'copyMove'
      }}
      onDragEnd={() => { if (root.current) delete root.current.dataset.richDragging; draggedText = null; if (!menuActive.current) save() }}
      onDrop={event => {
        const html = event.dataTransfer.getData('text/html')
        if (html && draggedText?.element !== root.current) {
          event.preventDefault()
          let range = document.caretRangeFromPoint(event.clientX, event.clientY)
          if (root.current && (!range || !root.current.contains(range.commonAncestorContainer))) { range = document.createRange(); range.selectNodeContents(root.current); range.collapse(false) }
          if (range && root.current) {
            root.current.focus()
            const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
            insertPastedHtml(html, event.dataTransfer.getData('text/plain'))
            dirty.current = true
            if (draggedText && !event.ctrlKey) { draggedText.range.deleteContents(); draggedText.element.dispatchEvent(new Event('input', { bubbles: true })) }
          }
        }
        window.setTimeout(() => { if (root.current && document.activeElement !== root.current) save() }, 0)
      }}
      dangerouslySetInnerHTML={editable ? undefined : { __html: markup }} />
    {position && editable && <div role="button" tabIndex={0} aria-label={`Move ${field}`} title="Drag the top edge to move text, or use arrow keys" className="absolute left-1 right-1 top-0 z-20 h-2" style={{ cursor: 'move', touchAction: 'none' }}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); moveRef.current = { startX: event.clientX, startY: event.clientY, x, y }; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => { const move = moveRef.current; const element = event.currentTarget.parentElement; if (move && element) {
        element.style.transform = `translate(${move.x + event.clientX - move.startX}px, ${move.y + event.clientY - move.startY}px)`
        const current = element.getBoundingClientRect()
        const matches: typeof guides = {}
        element.closest('[aria-label^="Site preview"]')?.querySelectorAll<HTMLElement>('[data-placed-media], [data-ws-image-index], [contenteditable="true"]').forEach(other => {
          if (element.contains(other) || other.contains(element)) return
          const rect = other.getBoundingClientRect(); if (!rect.width || !rect.height) return
          if (!matches.vertical) for (const [a, b] of [[current.left, rect.left], [current.right, rect.right], [(current.left + current.right) / 2, (rect.left + rect.right) / 2]]) if (Math.abs(a - b) <= 4) { const top = Math.min(current.top, rect.top); matches.vertical = { x: b, top, height: Math.max(current.bottom, rect.bottom) - top }; break }
          if (!matches.horizontal) for (const [a, b] of [[current.top, rect.top], [current.bottom, rect.bottom], [(current.top + current.bottom) / 2, (rect.top + rect.bottom) / 2]]) if (Math.abs(a - b) <= 4) { const left = Math.min(current.left, rect.left); matches.horizontal = { y: b, left, width: Math.max(current.right, rect.right) - left }; break }
        })
        setGuides(matches)
      } }}
      onPointerUp={event => { const move = moveRef.current; setGuides({}); if (move) { moveRef.current = null; updatePosition(move.x + event.clientX - move.startX, move.y + event.clientY - move.startY) } }}
      onPointerCancel={() => { moveRef.current = null; setGuides({}) }}
      onKeyDown={event => { const delta = event.shiftKey ? 10 : 1; const dx = event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0; const dy = event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0; if (dx || dy) { event.preventDefault(); event.stopPropagation(); updatePosition(x + dx, y + dy) } }} />}
    {position && editable && (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map(direction => <button key={direction} type="button" aria-label={`Resize ${field} ${direction}`} title="Drag to resize the text box" className="absolute z-30 h-3 w-3 border border-black bg-white opacity-0 group-hover/text:opacity-100 group-focus-within/text:opacity-100 focus:opacity-100" style={{ left: direction.includes('w') ? -6 : direction.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', top: direction.includes('n') ? -6 : direction.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', cursor: `${direction}-resize`, touchAction: 'none' }}
      onPointerDown={event => { const element = event.currentTarget.parentElement; const parent = element?.parentElement; if (!element || !parent || event.button !== 0) return; event.preventDefault(); event.stopPropagation(); const rect = element.getBoundingClientRect(); resizeRef.current = { startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height, maxWidth: parent.getBoundingClientRect().width, direction }; setResizeSize({ width: Math.round(rect.width), height: Math.round(rect.height) }); event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => { const resize = resizeRef.current; const element = event.currentTarget.parentElement; if (!resize || !element) return; const dx = event.clientX - resize.startX, dy = event.clientY - resize.startY; const width = Math.max(40, Math.min(resize.maxWidth, resize.width + (direction.includes('e') ? dx : direction.includes('w') ? -dx : 0))); const height = Math.max(24, resize.height + (direction.includes('s') ? dy : direction.includes('n') ? -dy : 0)); element.style.width = `${width}px`; element.style.minHeight = `${height}px`; setResizeSize({ width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) }) }}
      onPointerUp={event => { const resize = resizeRef.current; const element = event.currentTarget.parentElement; if (!resize || !element) return; resizeRef.current = null; useConfigStore.getState().updateBlockProps(blockId, { [`${field}Width`]: Math.round(element.getBoundingClientRect().width), [`${field}Height`]: Math.round(element.getBoundingClientRect().height) }); setResizeSize(null); event.stopPropagation() }} onPointerCancel={() => { resizeRef.current = null; setResizeSize(null) }} />)}
    {resizeSize && <span aria-live="polite" className="absolute right-0 top-full z-40 rounded bg-white px-1 text-xs font-normal leading-4 text-black">{resizeSize.width} × {resizeSize.height} px</span>}
    </Outer>
    {editable && (guides.vertical || guides.horizontal) && createPortal(<div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
      {guides.vertical && <div style={{ position: 'fixed', left: guides.vertical.x, top: guides.vertical.top, height: guides.vertical.height, width: 1, background: '#1683e5' }} />}
      {guides.horizontal && <div style={{ position: 'fixed', left: guides.horizontal.left, top: guides.horizontal.y, width: guides.horizontal.width, height: 1, background: '#1683e5' }} />}
    </div>, document.body)}
    {menu && createPortal(<div ref={menuElement} data-rich-menu data-studio-window role={menuView === 'context' ? 'menu' : 'dialog'} aria-label={menuView === 'context' ? 'Text context menu' : menuView === 'paragraph' ? 'Paragraph settings' : 'Text settings'} className={`fixed z-[10001] flex max-w-[calc(100vw-24px)] flex-col rounded border border-gray-400 bg-white text-sm font-normal text-black shadow-xl ${menuView === 'context' ? 'w-64 p-1' : 'w-80 p-4'}`} style={{ left: menu.x, top: menu.y }} onContextMenu={event => event.preventDefault()} onClick={event => event.stopPropagation()} onKeyDown={event => {
      if (menuView !== 'context' || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,summary')).filter(item => item.getClientRects().length > 0 && !(item instanceof HTMLButtonElement && item.disabled))
      const current = items.indexOf(document.activeElement as HTMLElement), next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
      event.preventDefault(); items[next]?.focus()
    }}>
      {menuView === 'context' && <div className="order-first flex flex-col">
        <button type="button" role="menuitem" className="rounded px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50" onMouseDown={event => event.preventDefault()} onClick={() => { menuMoved.current = false; setMenuView('text') }}>Text settings…</button>
        <button type="button" role="menuitem" className="rounded px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50" onMouseDown={event => event.preventDefault()} onClick={openParagraphSettings}>Paragraph settings…</button>
        <details><summary className="cursor-pointer rounded px-3 py-2 hover:bg-blue-50">Paste options</summary><div className="ml-2 border-l border-gray-200 pl-1">{([['match', 'Match destination formatting'], ['source', 'Keep source formatting'], ['plain', 'Paste plain text   Ctrl+Shift+V']] as const).map(([mode, label]) => <button key={mode} type="button" role="menuitem" className="block w-full rounded px-2 py-2 text-left text-xs hover:bg-blue-50 focus:bg-blue-50" onMouseDown={event => event.preventDefault()} onClick={() => void pasteFromClipboard(mode)}>{label}</button>)}</div></details>
        <button type="button" role="menuitem" className="rounded px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50" onMouseDown={event => event.preventDefault()} onClick={resetNormal}>Reset to Normal text</button>
        <button type="button" role="menuitem" className="rounded px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50" onMouseDown={event => event.preventDefault()} onClick={() => { setMenuView('text'); showLinkEditor() }}>Link…</button>
      </div>}
      {menuView !== 'context' && <div className="order-first mb-4 flex items-center justify-between border-b border-gray-200 pb-3" style={{ cursor: 'move', touchAction: 'none' }} title="Drag to move the settings window" onPointerDown={event => { if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return; const bounds = menuElement.current?.getBoundingClientRect(); if (!bounds) return; menuDrag.current = { x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }} onPointerMove={event => { const drag = menuDrag.current, element = menuElement.current; if (!drag || !element) return; menuMoved.current = true; element.style.left = `${Math.max(0, Math.min(window.innerWidth - element.offsetWidth, drag.left + event.clientX - drag.x))}px`; element.style.top = `${Math.max(0, Math.min(window.innerHeight - element.offsetHeight - 12, drag.top + event.clientY - drag.y))}px` }} onPointerUp={() => { menuDrag.current = null }} onPointerCancel={() => { menuDrag.current = null }}><strong className="text-base">{menuView === 'paragraph' ? 'Paragraph settings' : 'Text settings'}</strong><button type="button" aria-label="Close text settings" className="rounded px-2 text-lg hover:bg-gray-100" onClick={close}>×</button></div>}
      {menuView !== 'paragraph' && <details className="order-4 mt-3 border-t border-gray-200 pt-2"><summary className="cursor-pointer text-xs">More actions</summary>
      <button type="button" className="mt-2 block w-full rounded border border-gray-400 px-2 py-1 text-left" onClick={() => { close(); document.querySelector<HTMLButtonElement>('[aria-label="Expand right panel"]')?.click(); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-properties-tab]')?.click()) }}>Block properties</button>
      {(onDeleteBox || position) && <button type="button" className="mt-2 block w-full rounded border border-gray-400 px-2 py-1 text-left" onClick={() => { menuActive.current = false; dirty.current = false; setMenu(null); if (onDeleteBox) onDeleteBox(); else useConfigStore.getState().updateBlockProps(blockId, { [`${field}Hidden`]: true }) }}>Delete text box</button>}
      <div className="mt-2 flex flex-wrap gap-1">
        <button type="button" className="rounded border border-gray-400 px-2 py-1" onMouseDown={event => event.preventDefault()} onClick={() => {
          if (!root.current) return
          root.current.focus(); const range = document.createRange(); range.selectNodeContents(root.current)
          const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); savedRange.current = range.cloneRange(); setMenu({ ...menu })
        }}>Select all</button>
        {(['cut', 'copy', 'delete'] as const).map(command => <button key={command} type="button" disabled={!savedRange.current || savedRange.current.collapsed} className="rounded border border-gray-400 px-2 py-1 capitalize disabled:opacity-40" onMouseDown={event => event.preventDefault()} onClick={() => {
          if (!root.current || !savedRange.current || savedRange.current.collapsed) return
          root.current.focus(); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(savedRange.current)
          if (document.execCommand(command)) { if (command !== 'copy') dirty.current = true; close() }
        }}>{command}</button>)}
        <button type="button" className="rounded border border-gray-400 px-2 py-1" onMouseDown={event => event.preventDefault()} onClick={() => void pasteFromClipboard('match')}>Paste</button>
      </div>
      </details>}
      {clipboardError && <p role="status" className="mb-2 text-xs">{clipboardError}</p>}
      {menuView === 'text' && <>
      {linkEditor && <form aria-label="Text link" className="order-1 mb-3 space-y-2 border-b border-gray-200 pb-3" onSubmit={event => { event.preventDefault(); updateLink() }}>
        <label className="block text-xs">Link destination
          <input autoFocus value={linkEditor.address} onChange={event => setLinkEditor({ ...linkEditor, address: event.target.value, error: undefined })} placeholder="https://example.com or #anchor" className="mt-1 w-full rounded border border-gray-400 p-2 text-sm" />
        </label>
        <select aria-label="Choose a destination page" value="" onChange={event => setLinkEditor({ ...linkEditor, address: event.target.value, error: undefined })} className="w-full rounded border border-gray-400 p-2 text-sm">
          <option value="" disabled>Choose a site page…</option>
          {(useConfigStore.getState().config.pages ?? []).filter(page => page.webstudioArticle?.status !== 'draft').map(page => <option key={page.id} value={page.path}>{page.name}</option>)}
        </select>
        {linkEditor.error && <p role="alert" className="text-xs text-red-700">{linkEditor.error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="rounded bg-blue-700 px-2 py-1 text-white">Apply link</button>
          {linkEditor.hasLink && <button type="button" className="rounded border border-gray-400 px-2 py-1" onClick={() => updateLink(true)}>Remove link</button>}
          <button type="button" className="rounded border border-gray-400 px-2 py-1" onClick={() => setLinkEditor(null)}>Cancel</button>
        </div>
      </form>}
      <div className="order-2 mt-4 flex flex-wrap gap-1 border-t border-gray-200 pt-3" aria-label="Paragraph alignment">
        {(['left', 'center', 'right', 'justify'] as const).map(align => <button key={align} type="button" aria-label={`Align ${align}`} disabled={!savedRange.current || savedRange.current.collapsed} className="rounded border border-gray-400 px-2 py-1 capitalize disabled:opacity-40" onMouseDown={event => event.preventDefault()} onClick={() => {
          applyParagraph({ textAlign: align }); setMenu({ ...menu })
        }}>{align}</button>)}
      </div>
      {multiline && <div className="order-3 mt-3 border-t border-gray-200 pt-3"><button type="button" aria-label="Add bullets" disabled={!savedRange.current} className="rounded border border-gray-400 px-3 py-1 disabled:opacity-40" onMouseDown={event => event.preventDefault()} onClick={() => {
        if (!root.current || !savedRange.current || !root.current.contains(savedRange.current.commonAncestorContainer)) return
        const range = savedRange.current
        if (range.collapsed) return
        const fragment = range.extractContents()
        const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
        let startOfLine = true
        let node: Node | null
        while ((node = walker.nextNode())) {
          if (node instanceof HTMLElement && node.tagName === 'BR') { startOfLine = true; continue }
          if (node instanceof HTMLElement && ['DIV', 'P', 'LI'].includes(node.tagName)) { startOfLine = true; continue }
          if (node.nodeType !== Node.TEXT_NODE || !node.textContent) continue
          const original = node.textContent
          let updated = ''
          for (let i = 0; i < original.length; i++) {
            const character = original[i]
            if (startOfLine && character !== '\n') { if (character !== '•') updated += '• '; startOfLine = false }
            updated += character
            if (character === '\n') startOfLine = true
          }
          node.textContent = updated
        }
        range.insertNode(fragment); dirty.current = true; close()
      }}>• Bullets</button></div>}
      {!savedRange.current || savedRange.current.collapsed ? <p className="order-1 mb-2 text-xs">Select text to format it.</p> : <div className="order-1">
        {window.location.origin === 'https://webstudio.local' ? <label className="mb-3 block text-xs text-gray-700">Font<button type="button" aria-label="Choose Windows font" className="mt-1 w-full rounded border border-gray-400 p-2 text-left text-sm text-black" onMouseDown={event => event.preventDefault()} onClick={async () => {
          const node = savedRange.current?.startContainer
          const element = node instanceof Element ? node : node?.parentElement
          if (!element) return
          const style = getComputedStyle(element)
          const rgb = style.color.match(/\d+/g)?.slice(0, 3).map(value => Math.min(255, Number(value)).toString(16).padStart(2, '0')).join('')
          try {
            const result = await chooseWindowsFont({ font: style.fontFamily.split(',')[0].replace(/["']/g, '').trim().replace(/[^\p{L}\p{N} ,._-]/gu, '') || 'Arial', size: Math.max(6, Math.min(200, Math.round(parseFloat(style.fontSize) || 16))), color: rgb?.length === 6 ? `#${rgb}` : '#000000', bold: style.fontWeight === 'bold' || Number(style.fontWeight) >= 600, italic: style.fontStyle === 'italic', underline: style.textDecorationLine.includes('underline') })
            if (result) { apply({ fontFamily: result.font, fontSize: `${result.size}px`, color: result.color, fontWeight: result.bold ? 'bold' : 'normal', fontStyle: result.italic ? 'italic' : 'normal', textDecoration: result.underline ? 'underline' : 'none' }); setMenu({ ...menu }) }
          } catch { setClipboardError('The Windows font dialog could not be opened.') }
        }}>{selectedFont || 'Choose font'}…</button></label> : <label className="mb-3 block text-xs text-gray-700">Font<select aria-label="Text font" defaultValue={selectedFont} className="mt-1 w-full rounded border border-gray-400 p-2 text-sm text-black" onChange={event => { if (event.target.value) apply({ fontFamily: event.target.value }) }}><option value="">Choose font</option>{selectedFont && !['Arial', 'Calibri', 'Georgia', 'Tahoma', 'Times New Roman', 'Verdana'].includes(selectedFont) && <option value={selectedFont}>{selectedFont}</option>}{['Arial', 'Calibri', 'Georgia', 'Tahoma', 'Times New Roman', 'Verdana'].map(font => <option key={font}>{font}</option>)}</select></label>}
        <label className="mb-3 block text-xs text-gray-700">Font size (px)<input key={selectedSize} aria-label="Text font size" type="number" min="6" max="200" defaultValue={selectedSize} className="mt-1 w-full rounded border border-gray-400 p-2 text-sm text-black" onChange={event => { const size = Number(event.target.value); if (size >= 6 && size <= 200) apply({ fontSize: `${size}px` }) }} /></label>
        <div className="mb-2 flex items-center justify-between text-xs">Text color<WindowsColorInput label="Text color" value={selectedColor} onChange={value => { apply({ color: value }); setMenu({ ...menu }) }} className="h-7 w-10 rounded border border-gray-400" /></div>
        <div className="flex gap-2"><button type="button" className="rounded border border-gray-400 px-2 py-1 font-bold" onMouseDown={event => event.preventDefault()} onClick={() => { apply({ fontWeight: selectedStyle && (selectedStyle.fontWeight === 'bold' || Number(selectedStyle.fontWeight) >= 600) ? 'normal' : 'bold' }); setMenu({ ...menu }) }}>Bold</button><button type="button" className="rounded border border-gray-400 px-2 py-1 italic" onMouseDown={event => event.preventDefault()} onClick={() => { apply({ fontStyle: selectedStyle?.fontStyle === 'italic' ? 'normal' : 'italic' }); setMenu({ ...menu }) }}>Italic</button><button type="button" className="rounded border border-gray-400 px-2 py-1 underline" onMouseDown={event => event.preventDefault()} onClick={() => { apply({ textDecoration: selectedStyle?.textDecorationLine.includes('underline') ? 'none' : 'underline' }); setMenu({ ...menu }) }}>Underline</button></div>
        {!linkEditor && <button type="button" className="mt-2 rounded border border-gray-400 px-2 py-1" onMouseDown={event => event.preventDefault()} onClick={showLinkEditor}>Link…</button>}
      </div>}
      <button type="button" className="order-3 mt-3 rounded border border-gray-400 px-3 py-1 text-left" onMouseDown={event => event.preventDefault()} onClick={openParagraphSettings}>Paragraph settings…</button>
      <button type="button" className="order-5 mt-3 self-end rounded border border-gray-400 px-3 py-1" onClick={close}>Done</button>
      </>}
      {menuView === 'paragraph' && <form className="space-y-3" onSubmit={event => {
        event.preventDefault()
        applyParagraph({ textAlign: paragraph.align, lineHeight: String(paragraph.lineHeight), marginTop: `${paragraph.spaceBefore}px`, marginBottom: `${paragraph.spaceAfter}px`, marginLeft: `${paragraph.indentLeft}px`, marginRight: `${paragraph.indentRight}px`, textIndent: `${paragraph.firstLineIndent}px` })
        close()
      }}>
        <p className="text-xs text-gray-600">Applies to the selected paragraphs, or the paragraph containing the cursor.</p>
        <label className="block text-xs">Alignment<select aria-label="Paragraph alignment" value={paragraph.align} onChange={event => setParagraph({ ...paragraph, align: event.target.value })} className="mt-1 w-full rounded border border-gray-400 bg-white p-2 text-black">{['left', 'center', 'right', 'justify'].map(align => <option key={align} value={align}>{align.charAt(0).toUpperCase() + align.slice(1)}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">{([['lineHeight', 'Line spacing', 1, 3, 0.05], ['spaceBefore', 'Space before (px)', 0, 200, 1], ['spaceAfter', 'Space after (px)', 0, 200, 1], ['indentLeft', 'Left indent (px)', 0, 400, 1], ['indentRight', 'Right indent (px)', 0, 400, 1], ['firstLineIndent', 'First line (px)', -200, 400, 1]] as const).map(([key, label, minimum, maximum, step]) => <label key={key} className="block text-xs">{label}<input required aria-label={label} type="number" min={minimum} max={maximum} step={key === 'lineHeight' ? 'any' : step} value={paragraph[key]} onChange={event => setParagraph({ ...paragraph, [key]: Number(event.target.value) })} className="mt-1 w-full rounded border border-gray-400 bg-white p-2 text-black" /></label>)}</div>
        <p className="text-xs text-gray-600">Line spacing: 1 is single, 1.5 is one and a half, and 2 is double. A negative first-line value creates a hanging indent.</p>
        <div className="flex justify-end gap-2"><button type="button" className="rounded border border-gray-400 px-3 py-1" onClick={close}>Cancel</button><button type="submit" className="rounded bg-blue-700 px-3 py-1 text-white">Apply</button></div>
      </form>}

    </div>, document.body)}
  </>
}
