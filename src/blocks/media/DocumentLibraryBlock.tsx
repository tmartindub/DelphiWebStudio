import { useState } from 'react'
import type { BlockConfig } from '../types'

export function DocumentLibraryBlock({ block }: { block: BlockConfig }) {
  const [query, setQuery] = useState('')
  const title = typeof block.props.title === 'string' && block.props.title ? block.props.title : 'Documents'
  const items = Array.isArray(block.props.items) ? block.props.items : []
  const visible = items.filter(item => item && typeof item === 'object' && !Array.isArray(item) && `${typeof item.title === 'string' ? item.title : ''} ${typeof item.description === 'string' ? item.description : ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="p-6" data-document-library>
    <h2 className="text-xl font-semibold mb-3">{title}</h2>
    <label className="block text-sm mb-3">Search documents <input type="search" aria-label={`Search ${title}`} data-library-search value={query} onChange={event => setQuery(event.target.value)} className="ml-2 rounded border border-border-default bg-bg-2 px-2 py-1" /></label>
    <ul className="space-y-3">{visible.map((item, index) => <li key={index} data-library-item className="rounded border border-border-default p-3">
      {typeof item.src === 'string' && item.src ? <a className="text-green underline" href={item.src} download>{typeof item.title === 'string' && item.title ? item.title : 'Open document'}</a> : <span>{typeof item.title === 'string' && item.title ? item.title : 'Choose a document'}</span>}
      {typeof item.description === 'string' && item.description && <p className="text-sm mt-1">{item.description}</p>}
    </li>)}</ul>
  </section>
}
