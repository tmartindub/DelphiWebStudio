import { createElement, type ReactNode } from 'react'

/**
 * Simple markdown-to-React renderer. No dangerouslySetInnerHTML, no XSS surface.
 * Supports: ## headers, **bold**, *italic*, links, - lists, line breaks.
 */
export function renderMarkdown(text: string): ReactNode[] {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let listItems: ReactNode[] = []
  let key = 0

  function flushList() {
    if (listItems.length > 0) {
      nodes.push(createElement('ul', { key: key++, className: 'list-disc list-inside space-y-1 mb-4 text-text-1' }, ...listItems))
      listItems = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Empty line
    if (!trimmed) {
      flushList()
      continue
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList()
      nodes.push(createElement('h3', { key: key++, className: 'text-lg font-semibold font-display mb-2 mt-4' }, inlineFormat(trimmed.slice(4))))
      continue
    }
    if (trimmed.startsWith('## ')) {
      flushList()
      nodes.push(createElement('h2', { key: key++, className: 'text-xl font-semibold font-display mb-3 mt-5' }, inlineFormat(trimmed.slice(3))))
      continue
    }

    // List item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(createElement('li', { key: key++ }, inlineFormat(trimmed.slice(2))))
      continue
    }

    // Paragraph
    flushList()
    nodes.push(createElement('p', { key: key++, className: 'text-text-1 leading-relaxed mb-3' }, inlineFormat(trimmed)))
  }

  flushList()
  return nodes
}

function inlineFormat(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Italic
    const italicMatch = remaining.match(/\*(.+?)\*/)
    const linkMatch = remaining.match(/\[([^\]\n]+)\]\(([^)\s]+)\)/)

    // Find earliest match
    const boldIdx = boldMatch?.index ?? Infinity
    const italicIdx = italicMatch?.index ?? Infinity
    const linkIdx = linkMatch?.index ?? Infinity

    if (boldIdx === Infinity && italicIdx === Infinity && linkIdx === Infinity) {
      parts.push(remaining)
      break
    }

    if (linkIdx <= boldIdx && linkIdx <= italicIdx && linkMatch) {
      if (linkIdx > 0) parts.push(remaining.slice(0, linkIdx))
      const destination = linkMatch[2]
      const safe = !/[\\\p{Cc}]/u.test(destination) && !destination.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(destination) || /^(https?:|mailto:|tel:)/i.test(destination))
      parts.push(safe ? createElement('a', { key: key++, href: destination, className: 'text-green underline' }, linkMatch[1]) : linkMatch[0])
      remaining = remaining.slice(linkIdx + linkMatch[0].length)
    } else if (boldIdx <= italicIdx && boldMatch) {
      if (boldIdx > 0) parts.push(remaining.slice(0, boldIdx))
      parts.push(createElement('strong', { key: key++, className: 'font-semibold text-text-0' }, boldMatch[1]))
      remaining = remaining.slice(boldIdx + boldMatch[0].length)
    } else if (italicMatch) {
      if (italicIdx > 0) parts.push(remaining.slice(0, italicIdx))
      parts.push(createElement('em', { key: key++, className: 'italic' }, italicMatch[1]))
      remaining = remaining.slice(italicIdx + italicMatch[0].length)
    }
  }

  return parts
}
