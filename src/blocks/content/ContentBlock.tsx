import { renderMarkdown } from '@/lib/markdown'
import type { BlockConfig } from '../types'

export function ContentBlock({ block }: { block: BlockConfig }) {
  const { variant, props } = block
  if (variant === 'imported-source') {
    return (
      <section className="mx-4 my-2 rounded border border-border-default p-4 text-sm">
        <p>Unconverted HTML from {String(props.sourcePath || 'the imported page')} is preserved as read-only text. Rebuild this content before export; the original markup is not included in the website.</p>
        <details><summary>Inspect original HTML</summary><pre className="overflow-auto whitespace-pre-wrap">{String(props.rawHtml || '')}</pre></details>
      </section>
    )
  }
  const body = (props.body as string) || ''
  const rendered = renderMarkdown(body)

  if (variant === 'columns') {
    // Split rendered nodes roughly in half
    const mid = Math.ceil(rendered.length / 2)
    return (
      <div className="px-6 py-12 @lg:px-16 @lg:py-16">
        <div className="reveal-fade-up reveal-d1 grid grid-cols-1 @lg:grid-cols-2 gap-8 @lg:gap-12">
          <div>{rendered.slice(0, mid)}</div>
          <div>{rendered.slice(mid)}</div>
        </div>
      </div>
    )
  }

  if (variant === 'highlight') {
    return (
      <div className="px-6 py-12 @lg:px-16 @lg:py-16">
        <div className="reveal-slide-right reveal-d1 border-l-2 border-green pl-6 @lg:pl-8 bg-green-glow2 rounded-r-lg py-6 px-4">
          {rendered}
        </div>
      </div>
    )
  }

  // prose (default)
  return (
    <div className="reveal-fade-up reveal-d1 px-6 py-12 @lg:px-16 @lg:py-16 max-w-3xl mx-auto">
      {rendered}
    </div>
  )
}
